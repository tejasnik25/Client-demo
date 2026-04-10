import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '../../../auth';
import {
  getTransactionById,
  updateTransactionStatus
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

    console.log(`[PaymentApprove] Deposit approved for wallet credit only. transactionId=${transactionId}`);

    return NextResponse.json({
      success: true,
      message: `Payment approved and wallet credited`,
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
