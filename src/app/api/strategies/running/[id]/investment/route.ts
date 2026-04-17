import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import pool from '@/db/db';
import { v4 as uuidv4 } from 'uuid';
import {
  ensureInvestmentEventsTable,
  getRunningStrategyById,
  getStrategyById,
  getWalletBalance,
  getCachedMasterTrades,
  getUnifiedLotTimeline,
  getLotForTime,
  getEffectiveStrategyCapital,
  parseMt5DateToMs,
} from '@/db/dbService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Action = 'add' | 'reduce';

const safeNumber = (v: any): number => {
  const n = typeof v === 'string' ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const parseLotPricingRows = (lotPricing: any): Array<{ lot: number; amountUSD: number }> => {
  try {
    if (!lotPricing) return [];
    const parsed = typeof lotPricing === 'string' ? JSON.parse(lotPricing) : lotPricing;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => ({ lot: Number(x?.lot), amountUSD: Number(x?.amountUSD) }))
      .filter((x: any) => Number.isFinite(x.lot) && x.lot > 0 && Number.isFinite(x.amountUSD) && x.amountUSD > 0)
      .sort((a: any, b: any) => a.amountUSD - b.amountUSD);
  } catch {
    return [];
  }
};

const parseUnitPriceFromLotPricing = (lotPricing: any): number | null => {
  const rows = parseLotPricingRows(lotPricing);
  if (rows.length === 0) return null;
  const one = rows.find((x: any) => Number(x.lot) === 1);
  const unit = one ? Number(one.amountUSD) : Number(rows[0].amountUSD / rows[0].lot);
  return Number.isFinite(unit) && unit > 0 ? unit : null;
};

const deriveLotSize = (capital: number, lotPricing: any, fallbackUnitPrice: number = 1000): number => {
  const cap = Number(capital || 0);
  if (!Number.isFinite(cap) || cap <= 0) return 1;
  const rows = parseLotPricingRows(lotPricing);
  if (rows.length === 0) {
    return Math.max(1, Math.floor(cap / Math.max(1, fallbackUnitPrice)));
  }
  const one = rows.find((x) => Number(x.lot) === 1);
  if (one && Number.isFinite(one.amountUSD) && one.amountUSD > 0) {
    const derived = Math.floor(cap / Number(one.amountUSD));
    const lot = Math.max(1, derived);
    return lot;
  }
  let best = rows[0];
  for (const r of rows) {
    if (r.amountUSD <= cap) best = r;
    else break;
  }
  return Number.isFinite(best?.lot) && best.lot > 0 ? best.lot : 1;
};

const computeUserEquity = async (args: {
  userId: string;
  strategyId: string;
  runningStrategyId: string;
  masterId: string;
  currentCapital: number;
  lotPricing: any;
  minCapital: number;
}): Promise<number> => {
  try {
    const { userId, strategyId, runningStrategyId, masterId, currentCapital, lotPricing, minCapital } = args;

    const unitFallback = Number.isFinite(minCapital) && minCapital > 0 ? minCapital : 1000;
    const userLotMultiplierFallback = deriveLotSize(currentCapital, lotPricing, unitFallback);

    const timeline = await getUnifiedLotTimeline(userId, strategyId, runningStrategyId);
    const cached = await getCachedMasterTrades(masterId);
    const history = Array.isArray(cached?.history) ? cached.history : [];
    const openPositions = Array.isArray(cached?.open_positions) ? cached.open_positions : [];

    const unsettledHistory = history.filter(
      (t: any) => (t?.settlement_id == null) || String(t?.settlement_id || '').trim() === ''
    );

    const lotForNow = getLotForTime(Date.now(), timeline, userLotMultiplierFallback);

    const masterRealizedProfit = unsettledHistory.reduce((sum: number, t: any) => {
      const closeTs = parseMt5DateToMs(t.time_close ?? t.server_time_close ?? t.time_close_ms ?? null);
      const openTs = parseMt5DateToMs(t.time_open ?? t.server_time_open ?? t.time_open_ms ?? null);
      const eventTs = Number.isFinite(closeTs) ? closeTs : openTs;
      const lotAtEvent = Number.isFinite(eventTs)
        ? getLotForTime(eventTs, timeline, userLotMultiplierFallback)
        : userLotMultiplierFallback;
      return sum + (Number(t.profit) || 0) * lotAtEvent;
    }, 0);

    const masterRealizedSwap = unsettledHistory.reduce((sum: number, t: any) => {
      const closeTs = parseMt5DateToMs(t.time_close ?? t.server_time_close ?? t.time_close_ms ?? null);
      const openTs = parseMt5DateToMs(t.time_open ?? t.server_time_open ?? t.time_open_ms ?? null);
      const eventTs = Number.isFinite(closeTs) ? closeTs : openTs;
      const lotAtEvent = Number.isFinite(eventTs)
        ? getLotForTime(eventTs, timeline, userLotMultiplierFallback)
        : userLotMultiplierFallback;
      return sum + (Number(t.swap) || 0) * lotAtEvent;
    }, 0);

    const masterFloatingProfit = openPositions.reduce((sum: number, t: any) => sum + (Number(t.profit) || 0), 0);
    const masterFloatingSwap = openPositions.reduce((sum: number, t: any) => sum + (Number(t.swap) || 0), 0);

    // Commission handling matches running-strategies equity logic:
    // apply commission only on positive realized profit.
    const realizedProfit = masterRealizedProfit;
    const realizedSwap = masterRealizedSwap;
    const commissionPercent = 30;
    const realTimeCommission = realizedProfit > 0 ? (realizedProfit * commissionPercent / 100) : 0;
    const netProfit = realizedProfit - realTimeCommission;

    const totalRealizedBalance = currentCapital + realizedSwap + netProfit;

    const floatingProfit = masterFloatingProfit * lotForNow;
    const floatingSwap = masterFloatingSwap * lotForNow;

    // Equity formula: Equity = Deposit + Floating P/L
    const equity = currentCapital + floatingProfit + floatingSwap;
    return Number.isFinite(equity) ? equity : currentCapital;
  } catch (e) {
    console.warn('[InvestmentAdjust] computeUserEquity failed:', e);
    return args.currentCapital ?? 0;
  }
};

const getWalletTransactionsColumns = async (connection: any): Promise<string[]> => {
  try {
    const [columns]: any = await connection.execute(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_transactions'
      ORDER BY ORDINAL_POSITION
    `
    );
    return Array.isArray(columns) ? columns.map((r: any) => String(r.COLUMN_NAME)) : [];
  } catch {
    return [];
  }
};

// --- New: GET endpoint to fetch backend-calculated equity for robust UI sync ---
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const { id: rsId } = await params;
  const rs = await getRunningStrategyById(rsId);
  if (!rs) {
    return NextResponse.json({ success: false, error: 'Running strategy not found' }, { status: 404 });
  }
  const strategy = await getStrategyById(rs.strategyId);
  if (!strategy) {
    return NextResponse.json({ success: false, error: 'Strategy not found' }, { status: 404 });
  }
  const minCapital = Number(
    (strategy as any)?.minCapital ??
    (strategy as any)?.min_capital ??
    (strategy as any)?.parameters?.minCapital ??
    (strategy as any)?.parameters?.min_capital ??
    0
  );
  const lotPricing = (strategy as any)?.parameters?.lotPricing;
  const masterId = (strategy as any)?.masterAccountId;

  // Derive accurate deposit from wallet ledger instead of stale capital field
  let deposit = Number((rs as any)?.capital ?? 0);
  try {
    const ledgerCapital = await getEffectiveStrategyCapital(session.user.id, rs.strategyId, rsId);
    if (Number.isFinite(ledgerCapital) && ledgerCapital > 0) {
      deposit = ledgerCapital;
    }
  } catch (err) {
    console.warn('[InvestmentGET] Failed to derive deposit from ledger:', err);
  }

  let equityNow = deposit;
  if (masterId) {
    equityNow = await computeUserEquity({
      userId: session.user.id,
      strategyId: rs.strategyId,
      runningStrategyId: rsId,
      masterId,
      currentCapital: deposit,
      lotPricing,
      minCapital,
    });
  }
  return NextResponse.json({ success: true, equity: equityNow, deposit });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id: rsId } = await params;
  const body = await req.json().catch(() => ({}));

  const action = String(body?.action || '').trim().toLowerCase() as Action;
  const amount = safeNumber(body?.amount);

  if (!rsId) {
    return NextResponse.json({ success: false, error: 'Missing running strategy id' }, { status: 400 });
  }
  if (action !== 'add' && action !== 'reduce') {
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ success: false, error: 'Amount must be greater than 0' }, { status: 400 });
  }

  const rs = await getRunningStrategyById(rsId);
  if (!rs) {
    return NextResponse.json({ success: false, error: 'Running strategy not found' }, { status: 404 });
  }
  if (String(rs.userId) !== String(session.user.id)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const strategy = await getStrategyById(rs.strategyId);
  if (!strategy) {
    return NextResponse.json({ success: false, error: 'Strategy not found' }, { status: 404 });
  }

  const minCapital = Number(
    (strategy as any)?.minCapital ??
      (strategy as any)?.min_capital ??
      (strategy as any)?.parameters?.minCapital ??
      (strategy as any)?.parameters?.min_capital ??
      0
  );
  const lotPricing = (strategy as any)?.parameters?.lotPricing;
  const unitPrice = parseUnitPriceFromLotPricing(lotPricing);

  // Derive accurate current deposit from wallet ledger
  let currentCapital = Number((rs as any)?.capital ?? 0);
  try {
    const ledgerCapital = await getEffectiveStrategyCapital(session.user.id, rs.strategyId, rsId);
    if (Number.isFinite(ledgerCapital) && ledgerCapital > 0) {
      currentCapital = ledgerCapital;
    }
  } catch {}

  const nextCapital = action === 'add' ? currentCapital + amount : currentCapital - amount;

  if (action === 'add' && Number.isFinite(minCapital) && minCapital > 0 && nextCapital < minCapital) {
    return NextResponse.json(
      { success: false, error: `You must maintain minimum investment of $${minCapital.toFixed(2)} for this strategy.` },
      { status: 400 }
    );
  }

  if (action === 'reduce') {
    const masterId = (strategy as any)?.masterAccountId;
    if (!masterId) {
      return NextResponse.json(
        { success: false, error: 'Cannot compute equity for this strategy at the moment.' },
        { status: 400 }
      );
    }

    const equityNow = await computeUserEquity({
      userId: session.user.id,
      strategyId: rs.strategyId,
      runningStrategyId: rsId,
      masterId,
      currentCapital,
      lotPricing,
      minCapital,
    });

    if (Number.isFinite(minCapital) && minCapital > 0 && equityNow <= minCapital) {
      return NextResponse.json(
        {
          success: false,
          error: `Reduce investment not allowed. Your current equity ($${Number(equityNow || 0).toFixed(
            2
          )}) must be greater than the minimum investment ($${minCapital.toFixed(2)}).`,
        },
        { status: 400 }
      );
    }

    const maxByEquity = Number.isFinite(minCapital) ? Math.max(0, equityNow - minCapital) : equityNow;
    const maxReduce = Math.min(currentCapital, maxByEquity);

    if (amount > maxReduce) {
      return NextResponse.json(
        {
          success: false,
          error: `You can reduce up to $${maxReduce.toFixed(
            2
          )}. That keeps your equity at least $${Number(minCapital || 0).toFixed(
            2
          )} (current equity: $${Number(equityNow || 0).toFixed(2)}).`,
        },
        { status: 400 }
      );
    }
  }

  if (action === 'add') {
    const walletBalance = await getWalletBalance(session.user.id);
    if (walletBalance < amount) {
      return NextResponse.json(
        { success: false, error: `Insufficient wallet balance. Available: $${walletBalance.toFixed(2)}` },
        { status: 400 }
      );
    }
  }

  const unitFallbackForLot = Number.isFinite(minCapital) && minCapital > 0 ? minCapital : 1000;
  const nextLotSize = deriveLotSize(nextCapital, lotPricing, unitFallbackForLot);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await ensureInvestmentEventsTable();

    // Update running strategy capital + lot_size (schema may differ; attempt both columns safely)
    try {
      await connection.execute(
        'UPDATE running_strategies SET capital = ?, lot_size = ?, updated_at = NOW() WHERE id = ?',
        [nextCapital, nextLotSize, rsId]
      );
    } catch {
      await connection.execute('UPDATE running_strategies SET capital = ?, updated_at = NOW() WHERE id = ?', [nextCapital, rsId]);
    }

    // Ledger entry to support UI “Balance Operations” and lot-size recovery:
    // - Add: create a "charge" (deduct from wallet, treated as DEPOSIT on history page)
    // - Reduce: create a "settled" credit (adds to wallet, treated as WITHDRAWAL on history page)
    const now = new Date();
    const txId = `txn_inv_${uuidv4()}`;
    const isAdd = action === 'add';
    const transactionType = isAdd ? 'charge' : 'settled';
    const adminMessage = `${isAdd ? 'Investment Increase' : 'Investment Reduction'} (Equal x${nextLotSize})`;

    const availableColumns = await getWalletTransactionsColumns(connection);
    const insertData: Record<string, any> = {
      id: txId,
      user_id: session.user.id,
      amount,
      capital: amount,
      transaction_type: transactionType,
      payment_method: 'internal',
      transaction_id: `INV_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      strategy_id: rs.strategyId,
      running_strategy_id: rsId,
      lot_size: nextLotSize,
      status: 'completed',
      admin_message: adminMessage,
      created_at: now,
      updated_at: now,
    };

    const validEntries = Object.entries(insertData).filter(
      ([k, v]) => availableColumns.includes(k) && v !== undefined
    );
    if (validEntries.length === 0) {
      throw new Error('No compatible columns found in wallet_transactions for investment ledger insert.');
    }

    const fields = validEntries.map(([k]) => k);
    const values = validEntries.map(([, v]) => v);
    const placeholders = fields.map(() => '?').join(', ');
    await connection.execute(
      `INSERT INTO wallet_transactions (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );

    // Write a durable investment event (epoch ms) to avoid timezone parsing issues in production.
    try {
      await connection.execute(
        `INSERT INTO investment_events
         (id, user_id, strategy_id, running_strategy_id, event_ms, action, delta_amount, total_capital, lot_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `ie_${uuidv4()}`,
          session.user.id,
          rs.strategyId,
          rsId,
          Date.now(),
          isAdd ? 'add' : 'reduce',
          isAdd ? amount : -amount,
          nextCapital,
          nextLotSize,
        ]
      );
    } catch (e) {
      // Non-fatal: older schemas may not have the table; timeline API can still backfill from wallet_transactions.
      console.warn('[InvestmentAdjust] investment_events insert skipped:', (e as any)?.message || e);
    }

    await connection.commit();
    return NextResponse.json(
      {
        success: true,
        runningStrategyId: rsId,
        previousCapital: currentCapital,
        capital: nextCapital,
        lotSize: nextLotSize,
        unitPrice,
        minCapital,
        action,
        amount,
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
    );
  } catch (error: any) {
    await connection.rollback();
    console.error('[InvestmentAdjust] Failed:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to update investment' }, { status: 500 });
  } finally {
    connection.release();
  }
}

