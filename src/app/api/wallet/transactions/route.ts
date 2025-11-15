import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
  const {
      user_id,
      user_name,
      user_email,
      amount,
      transaction_type,
      payment_method,
      transaction_id,
      receipt_path,
      platform,
      mt_account_id,
      mt_account_password,
      terms_accepted,
      strategy_id,
      plan_level,
      // New optional fields
      inr_amount,
      inr_to_usd_rate,
      crypto_network,
      crypto_wallet_address,
      wallet_app_deeplink,
    } = body;

    if (!user_id || !amount || !transaction_type) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Debug payload for diagnosis
    console.log('Create wallet transaction payload', {
      user_id,
      user_name,
      user_email,
      amount,
      transaction_type,
      payment_method,
      transaction_id,
      receipt_path,
      platform,
      mt_account_id,
      terms_accepted,
      strategy_id,
      plan_level,
      inr_amount,
      inr_to_usd_rate,
      crypto_network,
      crypto_wallet_address,
      wallet_app_deeplink,
    });

    const { createWalletTransaction } = await import('@/db/dbService');

    const transaction = await createWalletTransaction({
      user_id,
      user_name,
      user_email,
      amount,
      transaction_type,
      payment_method,
      transaction_id,
      receipt_path,
      platform,
      mt_account_id,
      mt_account_password,
      terms_accepted,
      // Ensure strategy association is persisted for deployed/running views
      strategy_id,
      plan_level,
      inr_amount,
      inr_to_usd_rate,
      crypto_network,
      crypto_wallet_address,
      wallet_app_deeplink,
    });

    if (!transaction) {
      console.error('Failed to create wallet transaction: service returned null');
      return NextResponse.json({ success: false, error: 'Failed to create transaction' }, { status: 500 });
    }

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error('Error creating wallet transaction:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { getAllTransactions } = await import('@/db/dbService');
    const rows = await getAllTransactions();
    const transactions = rows.map((t: any) => ({
      id: t.id,
      user_id: t.user_id,
      amount: Number(t.amount ?? 0),
      transaction_type: t.transaction_type,
      payment_method: t.payment_method,
      transaction_id: t.transaction_id,
      receipt_path: t.receipt_path,
      platform: t.platform,
      mt_account_id: t.mt_account_id,
      mt_account_password: t.mt_account_password,
      mt_account_server: t.mt_account_server,
      terms_accepted: t.terms_accepted,
      strategy_id: t.strategy_id,
      plan_level: t.plan_level,
      inr_amount: t.inr_amount,
      inr_to_usd_rate: t.inr_to_usd_rate,
      crypto_network: t.crypto_network,
      crypto_wallet_address: t.crypto_wallet_address,
      wallet_app_deeplink: t.wallet_app_deeplink,
      admin_message: t.admin_message,
      admin_message_status: t.admin_message_status,
      rejection_reason: t.rejection_reason,
      status: t.status,
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));
    return NextResponse.json({ success: true, transactions }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}