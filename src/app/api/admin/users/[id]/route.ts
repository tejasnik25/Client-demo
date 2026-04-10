import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import {
  getUserById,
  getRunningStrategiesForUser,
  getClosedStrategiesForUser,
  getStrategyById,
  getCachedMasterTrades,
  getRunningStrategyTotalCapital,
  getSettlementsByUserAndStrategy,
  getUserStrategyDeposit,
} from '@/db/dbService';

async function getMasterTrades(strategyId: string, masterId: string) {
  // Try to fetch fresh data first with fallback to cache
  try {
    const host = process.env.NEXTAUTH_URL
      ? process.env.NEXTAUTH_URL.replace(/\/$/, '')
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://127.0.0.1:3000';
    const url = `${host}/api/strategies/${encodeURIComponent(strategyId)}/master-history`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return {
        history: Array.isArray(data.history) ? data.history : [],
        open_positions: Array.isArray(data.open_positions) ? data.open_positions : [],
      };
    }
  } catch (error) {
    console.warn('[AdminUserRoute] Live master history fetch failed, using cache:', error);
  }

  // Fallback to cache
  return await getCachedMasterTrades(masterId);
}

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
    let user = await getUserById(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Hide hashed password from admin response for security
    const { password, ...userSafe } = user;
    user = userSafe as any;

    // Fetch running strategies for the user
    const runningStrategies = await getRunningStrategiesForUser(userId);
    const closedStrategies = await getClosedStrategiesForUser(userId);
    
    // Enrich strategies with performance data from cached master trades
    const enrich = async (rs: any) => {
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
          const trades = await getMasterTrades(rs.strategyId, strategy.masterAccountId);

          const masterRealizedProfit = trades.history.reduce((sum: number, t: any): number => sum + (Number(t.profit) || 0), 0);
          const masterFloatingProfit = trades.open_positions.reduce((sum: number, t: any): number => sum + (Number(t.profit) || 0), 0);

          const totalStrategyCapital = await getRunningStrategyTotalCapital(rs.strategyId);
          const userCapital = Number(rs.capital || 0);
          const share = totalStrategyCapital > 0 ? userCapital / totalStrategyCapital : 1;

          // Check if profit settlement has been run
          const hasSettlements = (await getSettlementsByUserAndStrategy(userId, rs.strategyId)) || [];
          
          // Get invested amount from wallet_transactions as the baseline
          const investedAmount = await getUserStrategyDeposit(userId, rs.strategyId);

          if (hasSettlements.length > 0) {
            // Use settlement data if available (more accurate after settlement is run)
            // The user's current running capital already includes prior settled profit/swap and commission.
            const settlementTotals = hasSettlements.reduce<{ withdrawal: number; profit: number; swap: number; commission: number }>((acc, sItem) => {
              return {
                withdrawal: acc.withdrawal + Math.max(0, Number(sItem.withdrawal_amount || 0)),
                profit: acc.profit + Number(sItem.gross_profit || 0),
                swap: acc.swap + Number(sItem.swap_amount || 0),
                commission: acc.commission + Number(sItem.commission_amount || 0),
              };
            }, { withdrawal: 0, profit: 0, swap: 0, commission: 0 });

            metrics = {
              floatingProfit: masterFloatingProfit * share,
              realizedProfit: settlementTotals.profit,
              totalTrades: trades.history.length + trades.open_positions.length,
              openTrades: trades.open_positions.length,
              balance: Number(rs.capital || 0),
              equity: Number(rs.capital || 0) + (masterFloatingProfit * share),
              invested: investedAmount,
            };
          } else {
            // Use raw master profit calculation (before settlement)
            const realizedProfit = masterRealizedProfit * share;
            const floatingProfit = masterFloatingProfit * share;

            metrics = {
              floatingProfit,
              realizedProfit,
              totalTrades: trades.history.length + trades.open_positions.length,
              openTrades: trades.open_positions.length,
              balance: userCapital + realizedProfit,
              equity: userCapital + realizedProfit + floatingProfit,
              invested: investedAmount,
            };
          }
        }

        const normalizedCreatedAt = rs.created_at || rs.createdAt || rs.start_date || null;
        const normalizedUpdatedAt = rs.updated_at || rs.updatedAt || null;
        const normalizedCapital = Number(metrics?.invested || rs.capital || 0);

        return {
          ...rs,
          strategyName: strategy?.name || 'Unknown Strategy',
          strategyImage: strategy?.parameters?.image || strategy?.imageUrl,
          capital: Number(rs.capital || 0), // Current running capital
          invested: normalizedCapital, // Original invested capital
          plan: rs.plan || rs.planName || strategy?.parameters?.plan || 'N/A',
          adminStatus: rs.admin_status || rs.adminStatus || 'unknown',
          status: rs.status || rs.status || 'unknown',
          createdAt: normalizedCreatedAt,
          updatedAt: normalizedUpdatedAt,
          closedAt: rs.closed_at || null,
          deletedAt: rs.deleted_at || null,
          metrics: {
            floatingProfit: Number(metrics?.floatingProfit || 0),
            realizedProfit: Number(metrics?.realizedProfit || 0),
            totalTrades: Number(metrics?.totalTrades || 0),
            openTrades: Number(metrics?.openTrades || 0),
            balance: Number(metrics?.balance || Number(rs.capital || 0)),
            equity: Number(metrics?.equity || Number(rs.capital || 0)),
          },
        };
    };

    const enrichedStrategies = await Promise.all(runningStrategies.map(enrich));
    const enrichedClosedStrategies = await Promise.all(closedStrategies.map(enrich));

    return NextResponse.json({
      user,
      strategies: enrichedStrategies,
      closedStrategies: enrichedClosedStrategies,
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 });
  }
}
