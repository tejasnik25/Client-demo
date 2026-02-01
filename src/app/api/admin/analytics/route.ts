import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getAllUsers, getAllTransactions, getAllStrategies } from '@/db/dbService';
import { db } from '@/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await getAllUsers();
    const transactions = await getAllTransactions();
    const strategies = await getAllStrategies();

    const usersTotal = users.length;
    const usersActive = users.filter((u: any) => u.email_verified).length;
    const usersInactive = usersTotal - usersActive;
    const usersAdmin = users.filter((u: any) => u.role === 'ADMIN').length;
    const usersRegular = usersTotal - usersAdmin;

    const paymentsTotal = transactions.length;
    const paymentsApproved = transactions.filter((t: any) => t.status === 'completed').length;
    const paymentsPending = transactions.filter((t: any) => t.status === 'pending').length;
    const paymentsRejected = transactions.filter((t: any) => t.status === 'failed').length;
    const revenueTotal = transactions
      .filter((t: any) => t.status === 'completed')
      .reduce((sum: number, t: any) => sum + (typeof t.amount === 'number' ? t.amount : parseFloat(t.amount)), 0);

    const strategiesTotal = strategies.length;

    // Renewal payments from payments table
    let totalRenewals = 0;
    try {
      const [pr] = await db.query('SELECT COUNT(*) AS cnt FROM payments WHERE status IN ("renewal_pending","renewal_approved")');
      totalRenewals = Number((pr as any[])[0]?.cnt || 0);
    } catch {}

    return NextResponse.json({
      users: {
        total: usersTotal,
        active: usersActive,
        inactive: usersInactive,
        admin: usersAdmin,
        regular: usersRegular,
      },
      payments: {
        total: paymentsTotal,
        pending: paymentsPending,
        approved: paymentsApproved,
        rejected: paymentsRejected,
        renewals: totalRenewals,
      },
      revenue: {
        total: revenueTotal,
      },
      strategies: {
        total: strategiesTotal,
      },
    });
  } catch (error) {
    console.error('Error generating analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}