import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getUserById, getRunningStrategiesForUser, getStrategyById, getCachedMasterTrades, getRunningStrategyTotalCapital } from '@/db/dbService';

// Helper function to check admin authorization
async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }
  return session;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await checkAdminAuth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;
    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch running strategies for the user
    const runningStrategies = await getRunningStrategiesForUser(userId);
    
    // Enrich strategies with performance data from cached master trades
    const enrichedStrategies = await Promise.all(
      runningStrategies.map(async (rs) => {
        const strategy = await getStrategyById(rs.strategyId);
        
        // Get metrics from master account trades if available
        let metrics = {
          floatingProfit: 0,
          realizedProfit: 0,
          totalTrades: 0,
          openTrades: 0,
          equity: Number(rs.capital) || 0,
          balance: Number(rs.capital) || 0,
        };

        if (strategy?.masterAccountId) {
          const trades = await getCachedMasterTrades(strategy.masterAccountId);
          
          // Calculate Master PnL from history and live open trades
          const masterRealizedProfit = trades.history.reduce((sum, t) => sum + (Number(t.profit) || 0), 0);
          const masterFloatingProfit = trades.open_positions.reduce((sum, t) => sum + (Number(t.profit) || 0), 0);

          const totalStrategyCapital = await getRunningStrategyTotalCapital(rs.strategyId);
          const userCapital = Number(rs.capital || 0);
          const share = totalStrategyCapital > 0 ? userCapital / totalStrategyCapital : 1;

          const realizedProfit = masterRealizedProfit * share;
          const floatingProfit = masterFloatingProfit * share;

          metrics = {
            floatingProfit,
            realizedProfit,
            totalTrades: trades.history.length + trades.open_positions.length,
            openTrades: rs.open_trades !== undefined ? Number(rs.open_trades || 0) : trades.open_positions.length,
            balance: userCapital + realizedProfit,
            equity: userCapital + realizedProfit + floatingProfit,
          };
        }

        const normalizedCreatedAt = rs.created_at || rs.createdAt || rs.start_date || null;
        const normalizedUpdatedAt = rs.updated_at || rs.updatedAt || null;
        const normalizedCapital = Number(rs.capital || 0);

        return {
          ...rs,
          strategyName: strategy?.name || 'Unknown Strategy',
          strategyImage: strategy?.parameters?.image || strategy?.imageUrl,
          capital: normalizedCapital,
          plan: rs.plan || rs.planName || strategy?.parameters?.plan || 'N/A',
          adminStatus: rs.admin_status || rs.adminStatus || 'unknown',
          status: rs.status || rs.status || 'unknown',
          createdAt: normalizedCreatedAt,
          updatedAt: normalizedUpdatedAt,
          metrics: {
            floatingProfit: Number(metrics.floatingProfit || 0),
            realizedProfit: Number(metrics.realizedProfit || 0),
            totalTrades: Number(metrics.totalTrades || 0),
            openTrades: Number(metrics.openTrades || 0),
            balance: Number(metrics.balance || normalizedCapital),
            equity: Number(metrics.equity || normalizedCapital),
          },
        };
      })
    );

    return NextResponse.json({
      user,
      strategies: enrichedStrategies,
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 });
  }
}
