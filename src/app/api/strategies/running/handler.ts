import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { 
  getRunningStrategiesForUser, 
  getAllStrategies, 
  getRunningStrategyById, 
  getStrategyById,
  getRunningStrategyModifications,
  getDisconnectSnapshots,
  getRunningPeriods,
  getRunningStrategyTotalCapital,
  getCachedMasterTrades,
  getUserStrategyDeposit,
  getEffectiveStrategyCapital,
  getSettlementsByUserAndStrategy,
  createWalletTransaction,
  getLatestLotSizeForUserStrategy,
  getLotTimelineForUser,
  getLotForTime,
  parseMt5DateToMs
} from '@/db/dbService';
import { mt5Service, MtAccountDetails } from '@/lib/mt5-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

const deriveLotFromPricingTiers = (capital: number, lotPricing: any, fallbackUnitPrice: number): number => {
  const cap = Number(capital || 0);
  if (!Number.isFinite(cap) || cap <= 0) return 1;
  const rows = parseLotPricingRows(lotPricing);
  // If pricing is missing/invalid, fallback to per-strategy unit price.
  if (rows.length === 0) return Math.max(1, Math.floor(cap / Math.max(1, fallbackUnitPrice)));

  // Octa-style behavior: if a 1-lot unit price exists, scale as floor(cap/unitPrice).
  // Do NOT clamp to configured tiers: strategies can allow lots beyond preset examples.
  const one = rows.find((x) => Number(x.lot) === 1);
  if (one && Number.isFinite(one.amountUSD) && one.amountUSD > 0) {
    const derived = Math.floor(cap / Number(one.amountUSD));
    const lot = Math.max(1, derived);
    return lot;
  }

  // Fallback: Pick the maximum lot where amountUSD <= capital.
  let best = rows[0];
  for (const r of rows) {
    if (r.amountUSD <= cap) best = r;
    else break;
  }
  return Number.isFinite(best?.lot) && best.lot > 0 ? best.lot : 1;
};

/**
 * GET /api/strategies/running
 * Returns strategies currently running for the authenticated user.
 * A strategy is considered running if the user has a completed wallet transaction
 * associated with a strategy_id and the strategy is enabled.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // If no session, return empty list so the dashboard can render gracefully
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ strategies: [] });
    }

    const strategies = await getAllStrategies();
    const runningRows = await getRunningStrategiesForUser(userId);
    
    console.log(`[RunningStrategiesAPI] User ${userId} has ${runningRows.length} running strategy rows from DB`);
    runningRows.forEach((r: any) => {
      console.log(`[RunningStrategiesAPI] Row: id=${r.id}, strategy_id=${r.strategy_id}, status=${r.status}, admin_status=${r.admin_status}`);
    });

    // Only consider enabled strategies
    const enabledMap = new Map<string, any>();
    strategies
      .filter((s: any) => s.enabled !== false)
      .forEach((s: any) => enabledMap.set(s.id, s));

    // Approved transactions for this user that reference a strategy
    const running: any[] = [];
    for (const r of runningRows) {
      const s = Array.isArray(strategies) ? strategies.find((st: any) => st.id === r.strategyId) : null;
      const id = r.strategyId || s?.id;
      const name = s?.name || r.strategyName;
      if (!id) {
        running.push(null);
        continue;
      }

      // avoid opening too many DB connections in parallel by resolving each row sequentially.
      let modifications: any[] = [];
      let snapshots: any[] = [];
      let periods: any[] = [];
      try {
        modifications = await getRunningStrategyModifications(r.id);
      } catch (err) {
        console.error('[RunningStrategiesAPI] Error reading modifications for', r.id, err);
      }
      try {
        snapshots = await getDisconnectSnapshots(r.id);
      } catch (err) {
        console.error('[RunningStrategiesAPI] Error reading disconnect snapshots for', r.id, err);
      }
      try {
        periods = await getRunningPeriods(r.id);
      } catch (err) {
        console.error('[RunningStrategiesAPI] Error reading running periods for', r.id, err);
      }

      let deposit = Number(r.capital || 0);
      try {
        const ledgerCapital = await getEffectiveStrategyCapital(userId, id, r.id);
        // Prefer ledger-derived capital as the source of truth for invested amount.
        if (Number.isFinite(ledgerCapital) && ledgerCapital > 0) {
          deposit = ledgerCapital;
        }
      } catch (err) {
        console.warn('[RunningStrategiesAPI] Failed to derive capital from wallet ledger for', r.id, err);
      }
      // IMPORTANT: Do NOT fallback to getUserStrategyDeposit() because it sums ALL wallet_transactions
      // for the user+strategy, including old payments from when strategy was previously stopped.
      // The deposit should always come from the current running_strategy.capital field ONLY.
      if (deposit <= 0) {
        console.warn(`[RunningStrategiesAPI] Strategy ${id} has no capital set in running_strategies, using 0`);
      }

      let metrics = {
        floatingProfit: 0,
        realizedProfit: 0,
        totalTrades: 0,
        openTrades: 0,
        balance: deposit,
        equity: deposit,
      };

      if (s?.masterAccountId) {
        try {
          const trades = await getCachedMasterTrades(s.masterAccountId);
          // Important: only count UNSETTLED closed trades for live metrics.
          // Otherwise balance/equity keep changing based on already-settled history.
          const unsettledHistory = Array.isArray(trades?.history)
            ? trades.history.filter((t: any) => (t?.settlement_id == null) || String(t?.settlement_id || '').trim() === '')
            : [];
          const openPositions = Array.isArray(trades?.open_positions) ? trades.open_positions : [];
          
          const strategyParams = (s as any)?.parameters || {};
          const minCapRaw = Number(
            (s as any)?.minCapital ??
              (s as any)?.min_capital ??
              strategyParams?.minCapital ??
              strategyParams?.min_capital ??
              strategyParams?.min_investment ??
              (s as any)?.min_investment ??
              1000
          );
          const minCap = minCapRaw;
          const unitFallback = minCap;
          const userLotMultiplier = deriveLotFromPricingTiers(Number(r.capital || 0), (s as any)?.parameters?.lotPricing, unitFallback);

          // HARDCORE: Build investment timeline to apply historical lot sizes to realized profit
          const timeline = await getLotTimelineForUser(userId, id, unitFallback, r.id);

          const masterRealizedProfit = unsettledHistory.reduce((sum: number, t: any) => {
             const openTs = parseMt5DateToMs(t.time_open || t.open_time || t.time);
             const lotAtOpen = getLotForTime(openTs, timeline, userLotMultiplier);
             return sum + ((Number(t.profit) || 0) * lotAtOpen);
           }, 0);
           const masterRealizedSwap = unsettledHistory.reduce((sum: number, t: any) => {
             const openTs = parseMt5DateToMs(t.time_open || t.open_time || t.time);
             const lotAtOpen = getLotForTime(openTs, timeline, userLotMultiplier);
             return sum + ((Number(t.swap) || 0) * lotAtOpen);
           }, 0);

          const masterFloatingProfit = openPositions.reduce((sum: number, t: any) => sum + (Number(t.profit) || 0), 0);
          const masterFloatingSwap = openPositions.reduce((sum: number, t: any) => sum + (Number(t.swap) || 0), 0);
          
          const realizedProfit = masterRealizedProfit; // Already multiplied by historical lots
          const realizedSwap = masterRealizedSwap; // Already multiplied by historical lots
          let floatingProfit = masterFloatingProfit * userLotMultiplier;
          let floatingSwap = masterFloatingSwap * userLotMultiplier;

          const hasSettlements = (await getSettlementsByUserAndStrategy(userId, id)) || [];
          
          const commissionPercent = Number(s?.parameters?.commission || s?.parameters?.commissionPercent || 30);

          if (hasSettlements.length > 0) {
            const settlementTotals = hasSettlements.reduce((acc: any, sItem: any) => {
              return {
                withdrawal: acc.withdrawal + Math.max(0, Number(sItem.withdrawal_amount || 0)),
                profit: acc.profit + Number(sItem.gross_profit || 0),
                swap: acc.swap + Number(sItem.swap_amount || 0),
                commission: acc.commission + Number(sItem.commission_amount || 0),
              };
            }, { withdrawal: 0, profit: 0, swap: 0, commission: 0 });

            const openTradesCount = openPositions.length;
            if (openTradesCount === 0) {
              floatingProfit = 0;
              floatingSwap = 0;
            }

            // Hardcore real-time calculation: Use current realized profit * commission percent instead of settled commission
            // to ensure UI consistency before and after settlement.
            const currentRealizedProfit = realizedProfit; 
            const realTimeCommission = currentRealizedProfit > 0 ? (currentRealizedProfit * commissionPercent / 100) : 0;
            const netProfit = currentRealizedProfit - realTimeCommission;

            // Balance card shows Principal + Realized Swap + Net Profit
            const totalRealizedBalance = deposit + realizedSwap + netProfit;

            metrics.balance = totalRealizedBalance; 
            // Equity should only reflect principal + floating P/L.
            // Requirement: if no open trades => equity = deposit.
            // If open trades exist => equity = deposit + F P/L.
            metrics.equity = deposit + floatingProfit + floatingSwap;
            metrics.realizedProfit = currentRealizedProfit;
            metrics.floatingProfit = floatingProfit;
            metrics.openTrades = openPositions.length;
            metrics.totalTrades = unsettledHistory.length + openPositions.length;
          } else {
            const realTimeCommission = realizedProfit > 0 ? (realizedProfit * commissionPercent / 100) : 0;
            const netProfit = realizedProfit - realTimeCommission;
            const totalRealizedBalance = deposit + realizedSwap + netProfit;

            metrics = {
              floatingProfit,
              realizedProfit,
              totalTrades: unsettledHistory.length + openPositions.length,
              openTrades: openPositions.length,
              balance: totalRealizedBalance,
              // Equity should only reflect principal + floating P/L.
              equity: deposit + floatingProfit + floatingSwap,
            };
          }
        } catch (err) {
          console.warn('[RunningStrategiesAPI] Error computing metrics for', id, err);
        }
      }

      const minCap2 = Number(
        (s as any)?.minCapital ??
          (s as any)?.min_capital ??
          (s as any)?.parameters?.minCapital ??
          (s as any)?.parameters?.min_capital ??
          1000
      );
      const unitFallback2 = Number.isFinite(minCap2) && minCap2 > 0 ? minCap2 : 1000;
      const finalLotSize = deriveLotFromPricingTiers(Number(deposit || 0), (s as any)?.parameters?.lotPricing, unitFallback2);

      const obj = {
        id,
        rsId: r.id,
        strategyId: id,
        name,
        orders: [],
        profit: metrics.realizedProfit,
        adminStatus: r.adminStatus || r.admin_status || 'in-process',
        status: r.status,
        updatedAt: r.updatedAt || r.updated_at,
        createdAt: r.createdAt || r.created_at,
        plan: r.plan,
        lotSize: Number(finalLotSize || 1),
        capital: Number(deposit),
        deposit: Number(deposit),
        platform: r.platform ?? null,
        rejectionReason: r.rejectionReason ?? r.rejection_reason ?? null,
        modifications,
        snapshots,
        periods,
        metrics,
        // Flatten metrics for backward compatibility with some UI components
        floatProfit: metrics.floatingProfit,
        balance: metrics.balance,
        equity: metrics.equity,
        openTrades: metrics.openTrades,
      };
      console.log(`[RunningStrategiesAPI] Strategy ${obj.strategyId} for user ${userId} has adminStatus: ${obj.adminStatus}`);
      running.push(obj);
    }

    const filteredRunning = running
      .filter(Boolean)
      .filter((item: any) => {
        const aStatus = String(item.adminStatus || item.admin_status || '').toLowerCase();
        const uStatus = String(item.status || '').toLowerCase();
        // Once admin accepts stop-copy request, make user side hide it
        return aStatus !== 'disconnected' && aStatus !== 'stopped' && uStatus !== 'stopped';
      });

    // DEDUPLICATE: If multiple running_strategies exist for same strategy, keep only latest
    const latestByStrategy = new Map<string, any>();
    for (const item of filteredRunning) {
      const strategyId = String(item.strategyId || item.id || '');
      const existing = latestByStrategy.get(strategyId);
      // Keep the one with latest createdAt
      if (!existing || new Date(item.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
        latestByStrategy.set(strategyId, item);
        if (existing) {
          console.warn(`[RunningStrategiesAPI] DUPLICATE: Multiple running_strategies for strategy ${strategyId}. Keeping: ${item.rsId}, removing: ${existing.rsId}`);
        }
      }
    }
    const deduplicatedRunning = Array.from(latestByStrategy.values());

    console.log(`[RunningStrategiesAPI] After deduplication: ${deduplicatedRunning.length} active strategies (was ${filteredRunning.length})`);

    // Auto-recover missing subscriptions for running sessions in the background
    try {
      await Promise.all(
        (deduplicatedRunning as any[]).map(async (item) => {
          const st = String(item.adminStatus || item.status || '').toLowerCase();
          if (st !== 'running' && st !== 'active') return;
          try {
            const status = await mt5Service.checkConnectionStatus(item.rsId);
            const isMissing =
              (status.status === 'disconnected' &&
                ((status.error || '').includes('Subscription not found') ||
                 (status.detail || '').includes('Subscription not found'))) ||
              (status.status === 'error' &&
                ((status.error || '').includes('404') ||
                 (status.error || '').includes('Not Found') ||
                 (status.error || '').includes('Subscription not found')));
            if (isMissing) {
              const runningRow = await getRunningStrategyById(item.rsId);
              if (!runningRow) return;
              const strategyId = runningRow.strategyId || runningRow.strategy_id;
              if (!strategyId) return;
              const strategy = await getStrategyById(strategyId);
              if (!strategy || !(strategy as any).masterAccountId) return;
              const master: MtAccountDetails = {
                id: (strategy as any).masterAccountId,
                password: (strategy as any).masterAccountPassword || '',
                server: (strategy as any).masterAccountServer || '',
                platform: (((strategy as any).masterPlatform || 'MT5') as string).toUpperCase() === 'MT4' ? 'MT4' : 'MT5',
              };
              const slave: MtAccountDetails = {
                id: (runningRow as any).mtAccountId || '',
                password: (runningRow as any).mtAccountPassword || '',
                server: (runningRow as any).mtAccountServer || '',
                platform: (((runningRow as any).platform || 'MT5') as string).toUpperCase() === 'MT4' ? 'MT4' : 'MT5',
              };
              if (slave.id && slave.password) {
                await mt5Service.startCopyTrading(master, slave, item.rsId);
              }
            }
          } catch {
            // ignore per-item failures
          }
        })
      );
    } catch {
      // ignore batch failures
    }

    return NextResponse.json(
      { strategies: deduplicatedRunning },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
    );
  } catch (error) {
    console.error('Error computing running strategies:', error);
    return NextResponse.json(
      { strategies: [] },
      { status: 200, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
    );
  }
}
