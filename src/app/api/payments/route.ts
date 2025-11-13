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
    const { strategyId, plan, payable, method, mt4mt5, usdToInrRate, capital } = body;

    const { createWalletTransaction } = await import('@/db/dbService');

    const plan_level = plan as 'Premium' | 'Expert' | 'Pro';
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
      // store entered account capital when available
      capital: typeof capital === 'number' ? capital : undefined,
      transaction_type: 'deposit',
      payment_method: method,
      platform: mt4mt5?.type,
      mt_account_id: mt4mt5?.id,
      mt_account_password: mt4mt5?.password,
      mt_account_server: mt4mt5?.server,
      terms_accepted: true,
      strategy_id: strategyId,
      plan_level,
      inr_amount,
      inr_to_usd_rate,
      crypto_network,
      crypto_wallet_address,
      wallet_app_deeplink,
    });

    if (!tx) {
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
    }

    return NextResponse.json({ transactionId: tx.id });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const renewal = url.searchParams.get('renewal');

    if (renewal === 'true') {
      const [rows] = await db.query('SELECT * FROM payments ORDER BY created_at DESC');
      const payments = (rows as any[]).map((p) => ({
        id: p.id,
        userId: p.userId,
        txId: p.txId,
        strategyId: p.strategyId,
        plan: p.plan,
        capital: Number(p.capital ?? 0),
        payable: Number(p.payable ?? 0),
        method: p.method,
        proofUrl: p.proofUrl,
        status: p.status,
        createdAt: p.created_at ? (p.created_at instanceof Date ? p.created_at.toISOString() : p.created_at) : undefined,
      }));
      return NextResponse.json({ payments });
    }

    const { getAllTransactions } = await import('@/db/dbService');
    const txs = await getAllTransactions();
    const payments = txs.map((t: any) => ({
      id: t.id,
      userId: t.user_id,
      txId: t.transaction_id,
      strategyId: t.strategy_id,
      plan: t.plan_level,
      capital: Number(t.capital ?? t.amount ?? 0),
      payable: Number(t.amount ?? 0),
      method: t.payment_method,
      proofUrl: t.receipt_path,
      status: t.status,
      createdAt: t.created_at,
    }));
    return NextResponse.json({ payments });
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
    const fields: string[] = ['status = ?'];
    const values: any[] = [status];
    if (status === 'renewal_approved') {
      fields.push('approvedAt = NOW()');
      fields.push('verifiedBy = ?');
      values.push(session.user.id);
    }
    if (message) {
      fields.push('rejection_reason = ?');
      values.push(message);
    }
    values.push(paymentId);
    await (db as any).execute(`UPDATE payments SET ${fields.join(', ')} WHERE id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating payment status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}