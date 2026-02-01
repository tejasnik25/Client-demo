import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '../../auth';
import { updateTransactionStatus, sendEmailNotification, getUserById, updateUserTokens } from '../../../../../db/dbService';

/**
 * POST /api/admin/transactions/update
 * Update transaction status and add tokens to user account
 */
export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated and is an admin
    const session = await checkAdminAuth();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await req.json();
    const { transactionId, status, tokensToAdd = 0, adminId, rejectionReason } = body;

    // Validate required fields
    if (!transactionId || !status) {
      return NextResponse.json(
        { error: 'Transaction ID and status are required' },
        { status: 400 }
      );
    }

    // Validate status
    if (!['completed', 'failed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "completed" or "failed".' },
        { status: 400 }
      );
    }

    // Update transaction status
    const result = await updateTransactionStatus(transactionId, status, adminId || session.user.id, tokensToAdd, rejectionReason);
    
    if (!result.success || !result.transaction) {
      return NextResponse.json(
        { error: 'Failed to update transaction status' },
        { status: 404 }
      );
    }

    // Get user details
    const user = await getUserById(result.transaction.user_id);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // If approving and tokens to add, update user tokens
    if (status === 'completed' && tokensToAdd > 0) {
      const tokenResult = await updateUserTokens(user.id, tokensToAdd);
      if (!tokenResult.success) {
        console.error('Failed to update user tokens:', tokenResult.error);
        // Continue with transaction update even if token update fails
      }
    }

    // Send email notification to user
    try {
      if (status === 'completed') {
        const tokenMessage = tokensToAdd > 0 ? `\n${tokensToAdd} tokens have been added to your account.` : '';
        await sendEmailNotification(
          user.email,
          'Payment Approved',
          `Your payment of $${result.transaction.amount} has been approved.${tokenMessage}\n\nThank you for using our services!`
        );
      } else {
        await sendEmailNotification(
          user.email,
          'Payment Verification Failed',
          `We regret to inform you that your payment of $${result.transaction.amount} could not be verified.${rejectionReason ? `\nReason: ${rejectionReason}` : ''}\n\nPlease check the transaction details and try again.\n\nIf you believe this is an error, please contact our support team.`
        );
      }
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
      // Don't fail the entire operation if email fails
    }

    return NextResponse.json({ 
      success: true, 
      transaction: result.transaction,
      tokensAdded: status === 'completed' ? tokensToAdd : 0
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}