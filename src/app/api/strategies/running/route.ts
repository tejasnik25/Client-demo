import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getRunningStrategiesForUser, getAllStrategies, getRunningStrategyById, getStrategyById } from '@/db/dbService';
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
    const running = runningRows
      .map((r: any) => {
        const s = Array.isArray(strategies) ? strategies.find((st: any) => st.id === r.strategyId) : null;
        const id = r.strategyId || s?.id;
        const name = s?.name || r.strategyName;
        if (!id) return null;
        const obj = {
          id,
          rsId: r.id,
          strategyId: id,
          name,
          orders: [],
          profit: 0,
          adminStatus: r.adminStatus,
          status: r.status,
          updatedAt: r.updatedAt,
          createdAt: r.createdAt,
          plan: r.plan,
          capital: r.capital,
          platform: r.platform ?? null,
          // Do NOT expose any account credentials in API responses
          rejectionReason: r.rejectionReason ?? null,
        };
        return obj;
      })
      .filter(Boolean);

    // Auto-recover missing subscriptions for running sessions in the background
    try {
      await Promise.all(
        (running as any[]).map(async (item) => {
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
              const strategy = await getStrategyById(runningRow.strategyId);
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

    return NextResponse.json({ strategies: running });
  } catch (error) {
    console.error('Error computing running strategies:', error);
    return NextResponse.json({ strategies: [] }, { status: 200 });
  }
}
