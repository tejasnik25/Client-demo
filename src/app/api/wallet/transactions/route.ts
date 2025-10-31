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
    const transactions = await getAllTransactions();
    return NextResponse.json({ success: true, transactions });
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}