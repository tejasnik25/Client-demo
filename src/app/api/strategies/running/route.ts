import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getAllTransactions, getAllStrategies } from '@/db/dbService';

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

    const [txs, strategies] = await Promise.all([
      getAllTransactions(),
      getAllStrategies(),
    ]);

    // Only consider enabled strategies
    const enabledMap = new Map<string, any>();
    strategies
      .filter((s: any) => s.enabled !== false)
      .forEach((s: any) => enabledMap.set(s.id, s));

    // Approved transactions for this user that reference a strategy
    const approved = txs.filter(
      (t: any) => t.user_id === userId && t.status === 'completed' && !!t.strategy_id
    );

    // Shape response to match Dashboard expectations
    const running = approved
      .map((t: any) => {
        const s = enabledMap.get(t.strategy_id as string);
        if (!s) return null;
        return {
          id: s.id,
          name: s.name,
          // Dashboard currently expects these fields for display
          orders: [],
          profit: 0,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ strategies: running });
  } catch (error) {
    console.error('Error computing running strategies:', error);
    return NextResponse.json({ strategies: [] }, { status: 200 });
  }
}