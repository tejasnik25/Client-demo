import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { uploadToS3 } from '@/lib/s3';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    const isMultipart = contentType.includes('multipart/form-data');

    let body: any = {};
    let receiptFile: File | null = null;

    if (isMultipart) {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
      const rawReceipt = formData.get('receipt');
      receiptFile = rawReceipt && rawReceipt instanceof File ? rawReceipt : null;
    } else {
      body = await request.json();
    }

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
    } = body || {};

    const parsedAmount = typeof amount === 'string' ? Number(amount) : amount;
    const parsedInrAmount = typeof inr_amount === 'string' ? Number(inr_amount) : inr_amount;
    const parsedInrToUsd = typeof inr_to_usd_rate === 'string' ? Number(inr_to_usd_rate) : inr_to_usd_rate;
    const parsedTermsAccepted =
      typeof terms_accepted === 'string' ? ['true', '1', 'yes', 'on'].includes(terms_accepted.toLowerCase()) : !!terms_accepted;

    if (!user_id || !amount || !transaction_type) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Prevent creating transactions for other users
    if (String(user_id) !== String(session.user.id)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Do not log sensitive payloads

    const { createWalletTransaction } = await import('@/db/dbService');

    const resolveReceiptPath = async () => {
      if (!receiptFile) return receipt_path || null;

      const bytes = Buffer.from(await receiptFile.arrayBuffer());
      const extFromName = path.extname(receiptFile.name || '').toLowerCase();
      const ext =
        extFromName && extFromName.length <= 10 && extFromName.startsWith('.')
          ? extFromName
          : receiptFile.type && receiptFile.type.includes('png')
          ? '.png'
          : receiptFile.type && receiptFile.type.includes('jpeg')
          ? '.jpg'
          : receiptFile.type && receiptFile.type.includes('jpg')
          ? '.jpg'
          : receiptFile.type && receiptFile.type.includes('gif')
          ? '.gif'
          : '.bin';

      const safeUserId = String(user_id).replace(/[^\w.-]+/g, '_').slice(0, 60);
      const safeTxId = String(transaction_id || 'tx').replace(/[^\w.-]+/g, '_').slice(0, 60);
      const key = `wallet-proofs/${safeUserId}/${safeTxId}_${uuidv4()}${ext}`;

      try {
        const uploaded = await uploadToS3(key, bytes, receiptFile.type || 'application/octet-stream');
        return uploaded.url;
      } catch {
        // Local dev fallback if S3 isn't configured
        const fileName = `${safeTxId}_${uuidv4()}${ext}`.replace(/[^\w.-]+/g, '_');
        const dir = path.join(process.cwd(), 'public', 'uploads', 'wallet-proofs');
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, fileName), bytes);
        return `/uploads/wallet-proofs/${fileName}`;
      }
    };

    const finalReceiptPath = await resolveReceiptPath();

    const transaction = await createWalletTransaction({
      user_id,
      user_name,
      user_email,
      amount: parsedAmount,
      transaction_type,
      payment_method,
      transaction_id,
      receipt_path: finalReceiptPath,
      platform,
      mt_account_id,
      mt_account_password,
      terms_accepted: parsedTermsAccepted,
      // Ensure strategy association is persisted for deployed/running views
      strategy_id,
      plan_level,
      inr_amount: parsedInrAmount,
      inr_to_usd_rate: parsedInrToUsd,
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
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { getTransactionsByUser, getWalletBalance } = await import('@/db/dbService');
    const rows = await getTransactionsByUser(session.user.id);
    const balance = await getWalletBalance(session.user.id);
    const transactions = rows.map((t: any) => ({
      id: t.id,
      user_id: t.user_id,
      amount: Number(t.amount ?? 0),
      transaction_type: t.transaction_type,
      payment_method: t.payment_method,
      transaction_id: t.transaction_id,
      receipt_path: t.receipt_path,
      platform: t.platform,
      // Redact all account credentials from API responses
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
    return NextResponse.json({ success: true, transactions, balance }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
