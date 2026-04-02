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
  getSettlementsByUserAndStrategy
} from '@/db/dbService';
import { mt5Service, MtAccountDetails } from '@/lib/mt5-service';

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
        const d = await getUserStrategyDeposit(userId, id);
        if (d > 0) deposit = d;
      } catch (err) {
        console.warn('[RunningStrategiesAPI] Could not read deposit for', id, err);
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
          const masterRealizedProfit = trades.history.reduce((sum: number, t: any) => sum + (Number(t.profit) || 0), 0);
          const masterFloatingProfit = trades.open_positions.reduce((sum: number, t: any) => sum + (Number(t.profit) || 0), 0);
          const totalStrategyCapital = await getRunningStrategyTotalCapital(id);
          const userCapital = Number(r.capital || deposit || 0);
          const share = totalStrategyCapital > 0 ? userCapital / totalStrategyCapital : 1;

          const realizedProfit = masterRealizedProfit * share;
          const floatingProfit = masterFloatingProfit * share;

          const hasSettlements = (await getSettlementsByUserAndStrategy(userId, id)) || [];
          if (hasSettlements.length > 0) {
            const settlementTotals = hasSettlements.reduce((acc: any, sItem: any) => {
              return {
                withdrawal: acc.withdrawal + Math.max(0, Number(sItem.withdrawal_amount || 0)),
                profit: acc.profit + Number(sItem.gross_profit || 0),
                swap: acc.swap + Number(sItem.swap_amount || 0),
                commission: acc.commission + Number(sItem.commission_amount || 0),
              };
            }, { withdrawal: 0, profit: 0, swap: 0, commission: 0 });

            metrics.balance = deposit + settlementTotals.profit + settlementTotals.swap - settlementTotals.commission;
            metrics.equity = metrics.balance + floatingProfit;
            metrics.realizedProfit = settlementTotals.profit;
            metrics.floatingProfit = floatingProfit;
          } else {
            metrics = {
              floatingProfit,
              realizedProfit,
              totalTrades: trades.history.length + trades.open_positions.length,
              openTrades: trades.open_positions.length,
              balance: userCapital + realizedProfit,
              equity: userCapital + realizedProfit + floatingProfit,
            };
          }
        } catch (err) {
          console.warn('[RunningStrategiesAPI] Error computing metrics for', id, err);
        }
      }

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
        capital: Number(deposit),
        deposit: Number(deposit),
        platform: r.platform ?? null,
        rejectionReason: r.rejectionReason ?? r.rejection_reason ?? null,
        modifications,
        snapshots,
        periods,
        metrics,
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

    // Auto-recover missing subscriptions for running sessions in the background
    try {
      await Promise.all(
        (filteredRunning as any[]).map(async (item) => {
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

    return NextResponse.json({ strategies: filteredRunning });
  } catch (error) {
    console.error('Error computing running strategies:', error);
    return NextResponse.json({ strategies: [] }, { status: 200 });
  }
}
