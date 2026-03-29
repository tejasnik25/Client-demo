import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '../../../auth';
import {
  getTransactionById, 
  updateTransactionStatus,
  getStrategyById,
  createRunningStrategy,
  updateRunningStrategyAdminStatus,
  startRunningPeriod
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
      session.user.id,
      Number(transaction.amount) || 0
    );

    if (!updateResult.success || !updateResult.transaction) {
      return NextResponse.json(
        { success: false, error: 'Failed to update transaction status' },
        { status: 500 }
      );
    }

    // New: Handle Strategy Connection WITHOUT slave account details
    if (transaction.strategy_id) {
      try {
        // Ensure strategy exists for reference (not strictly required for this flow)
        await getStrategyById(transaction.strategy_id);

        // Create Running Strategy with minimal details; status defaults to in-process
        const runResult = await createRunningStrategy(
          transaction.user_id,
          transaction.strategy_id,
          (transaction.plan_level as 'Premium' | 'Expert' | 'Pro') || 'Pro',
          Number(transaction.capital || transaction.amount) || 0,
          {}
        );

        // After admin approves payment, immediately mark as running (Connected)
        if (runResult.success && runResult.id) {
          await updateRunningStrategyAdminStatus(runResult.id, 'running');
          await startRunningPeriod(runResult.id);
        }
      } catch (connError) {
        console.error('Error connecting strategy:', connError);
        // We don't fail the request because payment was already approved
      }
    }

    return NextResponse.json({
      success: true,
      message: `Payment approved and ${transaction.amount} tokens added to user account`,
      transaction: updateResult.transaction,
      user: updateResult.user
    });
  } catch (error) {
    console.error('Error approving payment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve payment' },
      { status: 500 }
    );
  }
}
