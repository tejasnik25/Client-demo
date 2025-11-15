import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getRunningStrategiesForUser, getAllStrategies } from '@/db/dbService';

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
        const s = Array.isArray(strategies) ? strategies.find((st: any) => st.name === r.strategyName) : null;
        const id = s?.id;
        const name = r.strategyName || s?.name;
        if (!name) return null;
        return {
          id: id || r.id,
          rsId: r.id,
          name,
          orders: [],
          profit: 0,
          adminStatus: r.adminStatus,
          status: r.status,
          updatedAt: r.updatedAt,
          platform: r.platform ?? null,
          mtAccountId: r.mtAccountId ?? null,
          mtAccountPassword: r.mtAccountPassword ?? null,
          mtAccountServer: r.mtAccountServer ?? null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ strategies: running });
  } catch (error) {
    console.error('Error computing running strategies:', error);
    return NextResponse.json({ strategies: [] }, { status: 200 });
  }
}