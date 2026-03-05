import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getAllTransactions, getUserById, getStrategyById } from '@/db/dbService';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const all = await getAllTransactions();
    const approved = all.filter((t: any) => t.status === 'completed');
    const transactions = await Promise.all(
      approved.map(async (t: any) => {
        const user = t.user_id ? await getUserById(t.user_id) : null;
        const strategy = t.strategy_id ? await getStrategyById(t.strategy_id) : null;
        return {
          id: t.id,
          user_id: t.user_id,
          amount: t.amount,
          capital: (t as any).capital ?? t.amount,
          transaction_type: t.transaction_type,
          payment_method: t.payment_method,
          transaction_id: t.transaction_id,
          receipt_path: t.receipt_path,
          platform: t.platform,
          terms_accepted: t.terms_accepted,
          strategy_id: t.strategy_id,
          plan_level: t.plan_level,
          status: t.status,
          created_at: t.created_at,
          updated_at: t.updated_at,
          user: user ? { name: user.name, email: user.email } : undefined,
          strategy: strategy ? { id: strategy.id, name: strategy.name } : undefined,
        };
      })
    );

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error fetching approved payments:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}