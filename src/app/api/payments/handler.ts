import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { db } from '@/db';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json();
    const { strategyId, payable, method, usdToInrRate } = body;

    const { createWalletTransaction } = await import('@/db/dbService');

    const inr_to_usd_rate = typeof usdToInrRate === 'number' ? usdToInrRate : parseFloat(process.env.NEXT_PUBLIC_USD_TO_INR_RATE || '83');
    const inr_amount = typeof payable === 'number' ? payable * inr_to_usd_rate : undefined;

    let crypto_network: 'ERC20' | 'TRC20' | undefined;
    let crypto_wallet_address: string | undefined;
    if (method === 'USDT_ERC20') {
      crypto_network = 'ERC20';
      crypto_wallet_address = process.env.NEXT_PUBLIC_USDT_ERC20_ADDRESS;
    } else if (method === 'USDT_TRC20') {
      crypto_network = 'TRC20';
      crypto_wallet_address = process.env.NEXT_PUBLIC_USDT_TRC20_ADDRESS;
    }

    const wallet_app_deeplink = process.env.NEXT_PUBLIC_USDT_WALLET_APP_LINK;

    const tx = await createWalletTransaction({
      user_id: session.user.id,
      user_name: session.user.name ?? undefined,
      user_email: session.user.email ?? undefined,
      amount: payable,
      capital: body.capital || payable, // Set capital from body or fallback to payable
      transaction_type: 'deposit',
      payment_method: method,
      platform: undefined,
      mt_account_id: undefined,
      mt_account_password: undefined,
      mt_account_server: undefined,
      terms_accepted: true,
      strategy_id: strategyId,
      lot_size: typeof body.lotSize === 'number' ? body.lotSize : undefined,
      plan_level: body.plan || 'Pro',  // Use the selected plan from request, fallback to 'Pro'
      inr_amount,
      inr_to_usd_rate,
      crypto_network,
      crypto_wallet_address,
      wallet_app_deeplink,
    });

    if (!tx) {
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
    }

    return NextResponse.json({ transactionId: tx.id, transaction_id: tx.transaction_id });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL(req.url);
    const renewal = url.searchParams.get('renewal');

    // Legacy renewal list is admin-only
    if (renewal === 'true') {
      if ((session.user as any)?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    const [rows] = await db.query('SELECT * FROM wallet_transactions WHERE transaction_type = ? ORDER BY created_at DESC', ['deposit']);
    const payments = (rows as any[]).map((p) => ({
      id: p.id,
      userId: p.user_id,
      txId: p.transaction_id,
      strategyId: p.strategy_id,
      plan: p.plan_level,
      capital: Number(p.amount ?? 0),
      payable: Number(p.amount ?? 0),
      method: p.payment_method,
      proofUrl: p.receipt_path,
      status: p.status,
      createdAt: p.created_at ? (p.created_at instanceof Date ? p.created_at.toISOString() : p.created_at) : undefined,
    }));
      return NextResponse.json({ payments });
    }

    // If admin, return all transactions; if user, return only their own with minimal fields
    const isAdmin = (session.user as any)?.role === 'ADMIN';
    if (isAdmin) {
      const { getAllTransactions } = await import('@/db/dbService');
      const txs = await getAllTransactions();
      const payments = txs.map((t: any) => ({
        id: t.id,
        userId: t.user_id,
        txId: t.transaction_id,
        strategyId: t.strategy_id,
        runningStrategyId: t.running_strategy_id,
        plan: t.plan_level,
        capital: Number(t.capital ?? t.amount ?? 0),
        payable: Number(t.amount ?? 0),
        method: t.payment_method,
        lotSize: Number(t.lot_size ?? t.lotSize ?? 0),
        proofUrl: t.receipt_path,
        status: t.status,
        admin_message: t.admin_message || t.adminMessage || '',
        createdAt: t.created_at,
      }));
      return NextResponse.json({ payments });
    } else {
      const { getTransactionsByUser } = await import('@/db/dbService');
      const txs = await getTransactionsByUser(session.user.id);
      const payments = txs.map((t: any) => ({
        id: t.id,
        userId: t.user_id,
        strategyId: t.strategy_id,
        runningStrategyId: t.running_strategy_id,
        transaction_type: t.transaction_type,
        payable: Number(t.amount ?? 0),
        capital: Number(t.capital ?? t.amount ?? 0),
        method: t.payment_method,
        lotSize: Number(t.lot_size ?? t.lotSize ?? 0),
        status: t.status,
        admin_message: t.admin_message || t.adminMessage || '',
        createdAt: t.created_at,
      }));
      return NextResponse.json({ payments });
    }
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const { paymentId, status, message } = body as { paymentId?: string; status?: string; message?: string };
    if (!paymentId || !status) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const allowed = ['pending','in_process','approved','failed','renewal_pending','renewal_approved','rejected'];
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Update payment status in payments table
    const fields: string[] = ['status = ?'];
    const values: any[] = [status];
    if (status === 'renewal_approved') {
      fields.push('approvedAt = NOW()');
      fields.push('verifiedBy = ?');
      fields.push('expiresAt = DATE_ADD(NOW(), INTERVAL 1 YEAR)');
      values.push(session.user.id);
      
      // Update the running strategy status to "in-process" for renewal
      try {
        // Get the payment to find the running strategy
        const [paymentRows] = await db.query('SELECT * FROM wallet_transactions WHERE id = ? AND transaction_type = ?', [paymentId, 'deposit']);
        if (Array.isArray(paymentRows) && paymentRows.length > 0) {
          const payment = paymentRows[0] as any;
          // Find the running strategy by userId and strategyId
          const [runRows] = await db.query(
            'SELECT id FROM running_strategies WHERE user_id = ? AND strategy_id = ? ORDER BY created_at DESC LIMIT 1',
            [payment.user_id, payment.strategy_id]
          );
          if (Array.isArray(runRows) && runRows.length > 0) {
            const runningStrategyId = (runRows[0] as any).id;
            // Update running strategy status to "in-process"
            await db.execute(
              'UPDATE running_strategies SET status = ? WHERE id = ?',
              ['in-process', runningStrategyId]
            );
          }
        }
      } catch (e) {
        console.error('Failed to update running strategy for renewal:', e);
        // Don't fail the whole request if running strategy update fails
      }
    }
    if (message) {
      fields.push('rejection_reason = ?');
      values.push(message);
    }
    values.push(paymentId);
    await db.execute(`UPDATE wallet_transactions SET ${fields.join(', ')} WHERE id = ? AND transaction_type = ?`, [...values.slice(0, -1), 'deposit', paymentId]);

    // If payment is approved, also update the corresponding wallet transaction status
    if (status === 'approved') {
      try {
        const { updateWalletTransactionStatus } = await import('@/db/dbService');
        
        // Get the payment details to find the corresponding wallet transaction
        const [paymentRows] = await db.query('SELECT * FROM wallet_transactions WHERE id = ? AND transaction_type = ?', [paymentId, 'deposit']);
        if (Array.isArray(paymentRows) && paymentRows.length > 0) {
          const payment = paymentRows[0] as any;
          
          // Find wallet transaction by user_id, strategy_id, and amount (since transaction_id might not match)
          const [walletTxRows] = await db.query(
            'SELECT id FROM wallet_transactions WHERE user_id = ? AND strategy_id = ? AND amount = ? AND transaction_type = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
            [payment.user_id, payment.strategy_id, payment.amount, 'deposit', 'pending']
          );
          
          if (Array.isArray(walletTxRows) && walletTxRows.length > 0) {
            const walletTxId = (walletTxRows[0] as any).id;
            await updateWalletTransactionStatus(walletTxId, 'completed');
          }
        }
      } catch (walletError) {
        console.error('Failed to update wallet transaction status:', walletError);
        // Don't fail the whole request if wallet update fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating payment status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
