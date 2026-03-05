import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { updateTransactionStatus, getUserById, updateUserTokens } from '@/db/dbService';

// Using a simpler approach for the route handler to fix build issues
export async function PUT(request: NextRequest, context: any) {
  const id = context.params?.id;
  
  try {
    const session = await getServerSession();
    
    // Check if user is authenticated and is an admin
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const transactionId = id;
    const { status, tokens } = await request.json();

    // Update transaction status
    const updateResult = await updateTransactionStatus(transactionId, status, session.user.id);
    
    if (!updateResult.success) {
      return NextResponse.json(
        { success: false, message: updateResult.error },
        { status: 400 }
      );
    }

    // If transaction is approved and tokens are provided, update user tokens
    if (status === 'APPROVED' && tokens) {
      const transaction = updateResult.transaction;
      
      // Get user
      const userResult = await getUserById(transaction.userId);
      
      if (!userResult.success) {
        return NextResponse.json(
          { success: false, message: 'User not found' },
          { status: 404 }
        );
      }
      
      const user = userResult.user;
      
      // Update user tokens
      const updateTokensResult = await updateUserTokens(user.id, user.tokens + tokens);
      
      if (!updateTokensResult.success) {
        return NextResponse.json(
          { success: false, message: 'Failed to update user tokens' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}