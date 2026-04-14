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
  getLatestLotSizeForUserStrategy,
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
          invested: 0,
        };

        if (strategy?.masterAccountId) {
          const trades = await getMasterTrades(rs.strategyId, strategy.masterAccountId);

          const masterRealizedProfit = trades.history.reduce((sum: number, t: any): number => sum + (Number(t.profit) || 0), 0);
          const masterFloatingProfit = trades.open_positions.reduce((sum: number, t: any): number => sum + (Number(t.profit) || 0), 0);

          // FIX: Use user's lot size multiplier for profit calculation instead of pool share
          const resolvedLotSize = await getLatestLotSizeForUserStrategy(userId, rs.strategyId, rs.id);
          const deriveLotSizeFromCapital = (): number => {
            try {
              const raw = (strategy as any)?.parameters?.lotPricing;
              if (!raw) return 1;
              const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
              if (!Array.isArray(parsed) || parsed.length === 0) return 1;

              const rows = parsed
                .map((x: any) => ({ lot: Number(x?.lot), amountUSD: Number(x?.amountUSD) }))
                .filter((x: any) => Number.isFinite(x.lot) && x.lot > 0 && Number.isFinite(x.amountUSD) && x.amountUSD > 0);
              if (rows.length === 0) return 1;

              const oneLot = rows.find((x: any) => Number(x.lot) === 1);
              const unitPrice = oneLot ? Number(oneLot.amountUSD) : Number(rows[0].amountUSD / rows[0].lot);
              if (!Number.isFinite(unitPrice) || unitPrice <= 0) return 1;

              const cap = Number(rs.capital || 0);
              if (!Number.isFinite(cap) || cap <= 0) return 1;

              const derived = cap / unitPrice;
              if (!Number.isFinite(derived) || derived <= 0) return 1;

              // Prefer clean display values (1,2,3,...) when close enough.
              const rounded = Math.round(derived);
              if (Math.abs(derived - rounded) < 0.12 && rounded > 0) return rounded;
              return Number(derived.toFixed(2));
            } catch {
              return 1;
            }
          };

          const rowLot = Number(rs.lot_size ?? rs.lotSize ?? 0);
          const txnLot = Number(resolvedLotSize || 0);
          const derivedLot = Number(deriveLotSizeFromCapital() || 0);

          let userLotMultiplier = 1;
          if (Number.isFinite(rowLot) && rowLot > 1) {
            userLotMultiplier = rowLot;
          } else if (Number.isFinite(txnLot) && txnLot > 1) {
            userLotMultiplier = txnLot;
          } else if (Number.isFinite(derivedLot) && derivedLot > 1) {
            userLotMultiplier = derivedLot;
          } else if (Number.isFinite(rowLot) && rowLot > 0) {
            userLotMultiplier = rowLot;
          } else if (Number.isFinite(txnLot) && txnLot > 0) {
            userLotMultiplier = txnLot;
          } else if (Number.isFinite(derivedLot) && derivedLot > 0) {
            userLotMultiplier = derivedLot;
          }

          // Check if profit settlement has been run
          const hasSettlements = (await getSettlementsByUserAndStrategy(userId, rs.strategyId)) || [];
          
          const commissionPercent = Number(strategy?.parameters?.commission || strategy?.parameters?.commissionPercent || 30);

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

            const currentRealizedProfit = masterRealizedProfit * userLotMultiplier;
            const realTimeCommission = currentRealizedProfit > 0 ? (currentRealizedProfit * commissionPercent / 100) : 0;

            metrics = {
              floatingProfit: masterFloatingProfit * userLotMultiplier,
              realizedProfit: currentRealizedProfit,
              totalTrades: trades.history.length + trades.open_positions.length,
              openTrades: trades.open_positions.length,
              balance: Number(rs.capital || 0) + currentRealizedProfit - realTimeCommission,
              equity: Number(rs.capital || 0) + currentRealizedProfit - realTimeCommission + (masterFloatingProfit * userLotMultiplier),
              invested: investedAmount,
            };
          } else {
            // Use raw master profit calculation (before settlement)
            const realizedProfit = masterRealizedProfit * userLotMultiplier;
            const floatingProfit = masterFloatingProfit * userLotMultiplier;
            const realTimeCommission = realizedProfit > 0 ? (realizedProfit * commissionPercent / 100) : 0;

            metrics = {
              floatingProfit,
              realizedProfit,
              totalTrades: trades.history.length + trades.open_positions.length,
              openTrades: trades.open_positions.length,
              balance: Number(rs.capital || 0) + realizedProfit - realTimeCommission,
              equity: Number(rs.capital || 0) + realizedProfit + floatingProfit - realTimeCommission,
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
