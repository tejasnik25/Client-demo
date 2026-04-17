import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import pool from '@/db/db';
import { ensureInvestmentEventsTable, getRunningStrategyById, getStrategyById } from '@/db/dbService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const parseLotPricingUnit = (lotPricing: any): number => {
  try {
    if (!lotPricing) return 1000;
    const parsed = typeof lotPricing === 'string' ? JSON.parse(lotPricing) : lotPricing;
    if (!Array.isArray(parsed) || parsed.length === 0) return 1000;
    const rows = parsed
      .map((x: any) => ({ lot: Number(x?.lot), amountUSD: Number(x?.amountUSD) }))
      .filter((x: any) => Number.isFinite(x.lot) && x.lot > 0 && Number.isFinite(x.amountUSD) && x.amountUSD > 0);
    const one = rows.find((r: any) => Number(r.lot) === 1);
    if (one) return Number(one.amountUSD);
    const unit = rows[0].amountUSD / rows[0].lot;
    return Number.isFinite(unit) && unit > 0 ? unit : 1000;
  } catch {
    return 1000;
  }
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const { id: rsId } = await params;
  const rs = await getRunningStrategyById(rsId);
  if (!rs) return NextResponse.json({ success: false, error: 'Running strategy not found' }, { status: 404 });
  if (String(rs.userId) !== String(session.user.id)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  await ensureInvestmentEventsTable();
  const strategy = await getStrategyById(rs.strategyId);
  const unitPrice = parseLotPricingUnit((strategy as any)?.parameters?.lotPricing);

  // Prefer investment_events if present; else backfill from wallet_transactions on the fly.
  const [evRows]: any = await pool.execute(
    `SELECT event_ms, action, delta_amount, total_capital, lot_size
     FROM investment_events
     WHERE user_id = ? AND strategy_id = ?
     ORDER BY event_ms ASC`,
    [rs.userId, rs.strategyId]
  );

  if (Array.isArray(evRows) && evRows.length > 0) {
    return NextResponse.json(
      { success: true, unitPrice, timeline: evRows.map((r: any) => ({ ...r, event_ms: Number(r.event_ms) })) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Backfill: build from wallet_transactions (works even if running_strategy_id column missing)
  const queryVariants: Array<{ query: string; params: any[] }> = [
    {
      query: `SELECT
                UNIX_TIMESTAMP(created_at) * 1000 AS event_ms,
                transaction_type,
                amount,
                capital,
                lot_size,
                status,
                admin_message
              FROM wallet_transactions
              WHERE user_id = ? AND strategy_id = ? AND (running_strategy_id = ? OR running_strategy_id IS NULL)
              ORDER BY created_at ASC`,
      params: [rs.userId, rs.strategyId, rsId],
    },
    {
      query: `SELECT
                UNIX_TIMESTAMP(created_at) * 1000 AS event_ms,
                transaction_type,
                amount,
                capital,
                0 AS lot_size,
                status,
                admin_message
              FROM wallet_transactions
              WHERE user_id = ? AND strategy_id = ? AND (running_strategy_id = ? OR running_strategy_id IS NULL)
              ORDER BY created_at ASC`,
      params: [rs.userId, rs.strategyId, rsId],
    },
    {
      query: `SELECT
                UNIX_TIMESTAMP(created_at) * 1000 AS event_ms,
                transaction_type,
                amount,
                capital,
                0 AS lot_size,
                status,
                admin_message
              FROM wallet_transactions
              WHERE user_id = ? AND strategy_id = ?
              ORDER BY created_at ASC`,
      params: [rs.userId, rs.strategyId],
    },
  ];

  let txRows: any[] = [];
  let lastErr: any = null;
  for (const variant of queryVariants) {
    try {
      const [rows]: any = await pool.execute(variant.query, variant.params);
      txRows = Array.isArray(rows) ? rows : [];
      lastErr = null;
      break;
    } catch (err: any) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;

  const extractLotFromMsg = (msg: string): number => {
    const s = String(msg ?? '').toLowerCase();
    const m = s.match(/(?:equal\s*x|x|lot\s*[:=])\s*(\d+(?:\.\d+)?)/i);
    return m ? Number(m[1]) : 0;
  };

  let total = 0;
  const timeline: any[] = [];
  for (const t of Array.isArray(txRows) ? txRows : []) {
    const status = String(t.status || '').toLowerCase();
    if (!['completed', 'approved', 'settled'].includes(status)) continue;
    const type = String(t.transaction_type || '').toLowerCase();
    const msg = String(t.admin_message || '').toLowerCase();
    const amt = Number(t.capital ?? t.amount ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) continue;

    const isReduction = (type === 'settled' || type === 'withdrawal') && msg.includes('investment reduction');
    const isIncrease = type === 'deposit' || type === 'charge';
    if (!isIncrease && !isReduction) continue;

    const delta = isReduction ? -amt : amt;
    total += delta;

    // Use recorded lot size if present, else fallback to admin message parsing, then recalculation
    const pLot = Number(t.lot_size || 0);
    const msgLot = extractLotFromMsg(msg);
    const lot = pLot > 0 ? pLot : (msgLot > 0 ? msgLot : Math.max(1, Math.floor(total / Math.max(1, unitPrice))));

    timeline.push({
      event_ms: Number(t.event_ms),
      action: isReduction ? 'reduce' : 'add',
      delta_amount: Number(delta.toFixed(2)),
      total_capital: Number(total.toFixed(2)),
      lot_size: lot,
    });
  }

  return NextResponse.json(
    { success: true, unitPrice, timeline },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

