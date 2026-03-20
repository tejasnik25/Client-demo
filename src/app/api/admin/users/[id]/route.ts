import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getUserById, getRunningStrategiesForUser, getStrategyById, getCachedMasterTrades } from '@/db/dbService';

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
          
          // Calculate Realized Profit from history
          const realizedProfit = trades.history.reduce((sum, t) => sum + (Number(t.profit) || 0), 0);
          
          // Calculate Floating Profit from open positions
          const floatingProfit = trades.open_positions.reduce((sum, t) => sum + (Number(t.profit) || 0), 0);
          
          metrics = {
            floatingProfit,
            realizedProfit,
            totalTrades: trades.history.length + trades.open_positions.length,
            openTrades: trades.open_positions.length,
            balance: Number(rs.capital) + realizedProfit,
            equity: Number(rs.capital) + realizedProfit + floatingProfit,
          };
        }

        return {
          ...rs,
          strategyName: strategy?.name || 'Unknown Strategy',
          strategyImage: strategy?.parameters?.image || strategy?.imageUrl,
          metrics,
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
