import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import {
  getRunningStrategiesForUser,
  createRunningStrategy,
  getStrategyById,
  getWalletBalance,
  updateRunningStrategyAdminStatus,
  createWalletTransaction,
  deleteRunningStrategyForUserStrategy,
  startRunningPeriod
} from '@/db/dbService';

const USC_PER_USD = 100;

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const strategies = await getRunningStrategiesForUser(session.user.id);
    const sanitized = (strategies || []).map((r: any) => {
      const {
        mtAccountId,
        mtAccountPassword,
        mtAccountServer,
        ...rest
      } = r || {};
      return rest;
    });
    return NextResponse.json(sanitized);
  } catch (error) {
    console.error('Error fetching running strategies:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json();
    const { strategyId, plan, capital, lotSize } = body;

    if (!strategyId || !plan || !capital) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    const strategyCapital = Number(capital);
    if (!Number.isFinite(strategyCapital) || strategyCapital <= 0) {
      return new NextResponse('Invalid strategy capital', { status: 400 });
    }

    const strategy = await getStrategyById(strategyId);
    if (!strategy) {
      return new NextResponse('Strategy not found', { status: 404 });
    }

    const strategyCurrency = String((strategy as any)?.parameters?.currency || 'USD').toUpperCase() === 'USC' ? 'USC' : 'USD';
    const walletChargeAmount = strategyCurrency === 'USC'
      ? Number((strategyCapital / USC_PER_USD).toFixed(2))
      : strategyCapital;

    // Validate available central wallet balance before purchase
    const availableBalance = await getWalletBalance(session.user.id);
    if (walletChargeAmount > availableBalance) {
      return new NextResponse('Insufficient central wallet balance for this strategy purchase', { status: 400 });
    }

    const selectedLotSize = Number(lotSize || 1);
    if (!Number.isFinite(selectedLotSize) || selectedLotSize <= 0) {
      return new NextResponse('Invalid lot size', { status: 400 });
    }

    // Ensure user has only one active row per strategy before creating a fresh purchase.
    await deleteRunningStrategyForUserStrategy(session.user.id, strategyId);

    const result = await createRunningStrategy(
      session.user.id,
      strategyId,
      plan,
      strategyCapital,
      selectedLotSize,
      {}
    );

    if (result.success && result.id) {
      // Deduct wallet balance for strategy purchase as a charge transaction.
      try {
        if (walletChargeAmount > 0) {
          const capitalMessage = strategyCurrency === 'USC'
            ? `Reserved ${strategyCapital.toFixed(2)} USC capital for running strategy ${strategyId} (${result.id}) by charging $${walletChargeAmount.toFixed(2)} USD`
            : `Reserved capital for running strategy ${strategyId} (${result.id})`;
          const chargeTxn = await createWalletTransaction({
            user_id: session.user.id,
            amount: walletChargeAmount,
            capital: strategyCapital,
            transaction_type: 'charge',
            status: 'completed',
            strategy_id: strategyId,
            lot_size: selectedLotSize,
            running_strategy_id: result.id,
            plan_level: plan,
            admin_message: capitalMessage
          });
          if (!chargeTxn) {
            console.error('[RunningStrategiesAPI] Wallet charge transaction failed');
            return new NextResponse('Failed to reserve central wallet funds for strategy purchase', { status: 500 });
          }
        }
      } catch (reserveError) {
        console.error('[RunningStrategiesAPI] Failed to create strategy reservation transaction:', reserveError);
        return new NextResponse('Failed to reserve central wallet funds for strategy purchase', { status: 500 });
      }

      // Mark strategy as running immediately for wallet-funded purchase flow.
      await updateRunningStrategyAdminStatus(result.id, 'running');
      await startRunningPeriod(result.id);

      return NextResponse.json({ success: true, id: result.id, status: 'running' });
    } else {
      return new NextResponse('Failed to create running strategy', { status: 500 });
    }
  } catch (error) {
    console.error('Error creating running strategy:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
