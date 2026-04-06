import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '../../../auth';
import {
  getTransactionById,
  updateTransactionStatus,
  getStrategyById,
  createRunningStrategy,
  updateRunningStrategyAdminStatus,
  startRunningPeriod,
  getRunningStrategyById,
  deleteRunningStrategyForUserStrategy,
  linkWalletTransactionsToRunningStrategy,
  createWalletTransaction
} from '@/db/dbService';

type Params = { id: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    // Ensure admin is authenticated
    const session = await checkAdminAuth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const transactionId = params.id;

    // Fetch the transaction directly
    const transaction = await getTransactionById(transactionId);
    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Approve: mark completed and add tokens equal to amount
    const updateResult = await updateTransactionStatus(
      transactionId,
      'completed',
      session.user.id
    );

    if (!updateResult.success || !updateResult.transaction) {
      return NextResponse.json(
        { success: false, error: 'Failed to update transaction status' },
        { status: 500 }
      );
    }

    // Apply charge to wallet to reflect strategy capital reservation (reduces available central balance)
    // NOTE: Will link to running_strategy_id after it's created below
    let chargeTransactionCreated = false;
    try {
      const capitalAmount = Number(transaction.capital || transaction.amount || 0);
      if (capitalAmount > 0) {
        await createWalletTransaction({
          user_id: transaction.user_id,
          amount: capitalAmount,
          capital: capitalAmount,
          transaction_type: 'charge',
          status: 'completed',
          strategy_id: transaction.strategy_id || transaction.strategyId || null,
          running_strategy_id: null, // Will be updated after running_strategy is created
          plan_level: transaction.plan_level || null,
          admin_message: `Reserved capital for strategy connection from payment ${transactionId}`
        });
        chargeTransactionCreated = true;
      }
    } catch (chargeError) {
      console.error('[PaymentApprove] Failed to create strategy charge transaction:', chargeError);
    }

    // New: Handle Strategy Connection WITHOUT slave account details
    const strategyId = transaction.strategy_id || transaction.strategyId;
    if (strategyId && transaction.user_id) {
      try {
        console.log(`[PaymentApprove] Connecting strategy ${strategyId} for user ${transaction.user_id}`, {
          transactionId,
          planLevel: transaction.plan_level,
          capital: transaction.capital,
          amount: transaction.amount
        });
        
        // Ensure strategy exists for reference (not strictly required for this flow)
        const strategy = await getStrategyById(strategyId);
        if (!strategy) {
          console.warn(`[PaymentApprove] Strategy ${strategyId} not found in DB, proceeding anyway`);
        } else {
          console.log(`[PaymentApprove] Found strategy: ${strategy.name}`);
        }

        // Cleanup old strategy row(s) for this user+strategy to guarantee fresh re-purchase state
        await deleteRunningStrategyForUserStrategy(transaction.user_id, strategyId);

        // Create Running Strategy with minimal details
        const capital = Number(transaction.capital || transaction.amount) || 0;
        const plan = (transaction.plan_level as 'Premium' | 'Expert' | 'Pro') || 'Pro';
        console.log(`[PaymentApprove] Creating running strategy:`, {
          userId: transaction.user_id,
          strategyId,
          plan,
          capital
        });
        
        const runResult = await createRunningStrategy(
          transaction.user_id,
          strategyId,
          plan,
          capital,
          {}
        );

        console.log(`[PaymentApprove] createRunningStrategy returned:`, runResult);

        if (!runResult.success || !runResult.id) {
          console.error(`[PaymentApprove] Failed to create running strategy:`, runResult.error || 'unknown error');
          // Still continue - payment was already approved
        } else {
          const rsId = runResult.id;
          console.log(`[PaymentApprove] Created running strategy: ${rsId}`);
          
          // Verify the strategy was actually created
          const verifyRS = await getRunningStrategyById(rsId);
          console.log(`[PaymentApprove] Verified running strategy from DB:`, verifyRS ? { id: verifyRS.id, status: verifyRS.status, adminStatus: verifyRS.admin_status } : 'NOT FOUND');
          
          // After admin approves payment, immediately mark as running (Connected)
          console.log(`[PaymentApprove] Updating admin status to running for ${rsId}`);
          const statusUpdated = await updateRunningStrategyAdminStatus(rsId, 'running');
          console.log(`[PaymentApprove] Admin status update result:`, statusUpdated);

          // Verify status was updated
          const verifyStatus = await getRunningStrategyById(rsId);
          console.log(`[PaymentApprove] Verified status after update:`, verifyStatus ? { id: verifyStatus.id, status: verifyStatus.status, adminStatus: verifyStatus.admin_status } : 'NOT FOUND');

          console.log(`[PaymentApprove] Starting running period for ${rsId}`);
          const periodResult = await startRunningPeriod(rsId);
          console.log(`[PaymentApprove] Running period started successfully:`, periodResult);
          
          // Link deposit and charge transactions to this running_strategy_id
          try {
            const linked = await linkWalletTransactionsToRunningStrategy(rsId, transaction.user_id, strategyId);
            console.log(`[PaymentApprove] Linked wallet_transactions to running_strategy ${rsId}: ${linked}`);
          } catch (linkError) {
            console.error('[PaymentApprove] Failed to link wallet_transactions to running_strategy:', linkError);
          }
        }
      } catch (connError) {
        console.error('[PaymentApprove] Error connecting strategy:', connError instanceof Error ? connError.message : connError);
        // We don't fail the request because payment was already approved
      }
    } else {
    console.log(`[PaymentApprove] Final response - success: ${updateResult.success}, transactionId: ${transactionId}`);
    
      console.warn(`[PaymentApprove] Skipping strategy connection:`, {
        hasStrategyId: !!strategyId,
        hasUserId: !!transaction.user_id,
        strategyId,
        userId: transaction.user_id
      });
    }

    return NextResponse.json({
      success: true,
      message: `Payment approved and strategy connected for user`,
      transaction: updateResult.transaction
    });
  } catch (error) {
    console.error('Error approving payment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve payment' },
      { status: 500 }
    );
  }
}
