import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getPendingOrInProcessTransactions, getUserById, getStrategyById } from '@/db/dbService';

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated and is admin
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get only pending or in-process transactions for admin review
    const allTransactions = await getPendingOrInProcessTransactions();

    // Hydrate with user and strategy info and include MT details
    const transactions = await Promise.all(
      allTransactions.map(async (transaction) => {
        const user = transaction.user_id ? await getUserById(transaction.user_id) : null;
        const strategy = transaction.strategy_id ? await getStrategyById(transaction.strategy_id) : null;
        return {
          id: transaction.id,
          user_id: transaction.user_id,
          amount: transaction.amount,
          transaction_type: transaction.transaction_type,
          payment_method: transaction.payment_method,
          transaction_id: transaction.transaction_id, 
          receipt_path: transaction.receipt_path,
          platform: transaction.platform,
          mt_account_id: transaction.mt_account_id,
          mt_account_password: transaction.mt_account_password,
          terms_accepted: transaction.terms_accepted,
          strategy_id: transaction.strategy_id,
          plan_level: transaction.plan_level,
          capital: (transaction as any).capital ?? transaction.amount,
          status: transaction.status,
          created_at: transaction.created_at,
          updated_at: transaction.updated_at,
          admin_message: (transaction as any).admin_message,
          admin_message_status: (transaction as any).admin_message_status,
          user: user ? { name: user.name, email: user.email } : undefined,
          strategy: strategy ? { id: strategy.id, name: strategy.name } : undefined,
        };
      })
    );

    return NextResponse.json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}