import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '../../../auth';
import { updateTransactionStatus } from '@/db/dbService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const body = await request.json().catch(() => ({}));
    const { rejectionReason } = body as { rejectionReason?: string };
    
    // Update transaction status to failed (rejected)
    const updateResult = await updateTransactionStatus(transactionId, 'failed', session.user.id, undefined, rejectionReason);
    
    if (!updateResult.success || !updateResult.transaction) {
      return NextResponse.json(
        { success: false, error: 'Failed to update transaction status' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Payment rejected successfully',
      transaction: updateResult.transaction
    });
  } catch (error) {
    console.error('Error rejecting payment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reject payment' },
      { status: 500 }
    );
  }
}