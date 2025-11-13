import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';

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