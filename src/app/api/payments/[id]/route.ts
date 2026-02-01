import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { txId, proofUrl, status, isRenewal, runningStrategyId } = body as { 
      txId: string; 
      proofUrl: string; 
      status?: 'pending'|'in-process'|'completed'|'failed'|'renewal_pending';
      isRenewal?: boolean;
      runningStrategyId?: string;
    };

    const { updateTransactionProof } = await import('@/db/dbService');
    const { db } = await import('@/db');
    
    // Determine the status - for renewals use renewal_pending
    const finalStatus = (isRenewal && status === 'renewal_pending') ? 'renewal_pending' : (status ?? 'in-process');
    const updated = await updateTransactionProof(params.id, txId, proofUrl, finalStatus as any);

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
    }

    // If this is a renewal, create a payment record in the payments table
    if (isRenewal && updated.strategy_id && updated.user_id) {
      try {
        const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const mt4mt5Json = JSON.stringify({
          type: updated.platform || 'MT4',
          id: updated.mt_account_id || '',
          password: updated.mt_account_password || '',
          server: updated.mt_account_server || '',
        });
        
        await (db as any).execute(
          `INSERT INTO payments (id, userId, strategyId, plan, capital, payable, method, txId, proofUrl, mt4mt5, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            paymentId,
            updated.user_id,
            updated.strategy_id,
            updated.plan_level || 'Pro',
            updated.capital || updated.amount || 0,
            updated.amount || 0,
            updated.payment_method || 'USDT_ERC20',
            txId,
            proofUrl,
            mt4mt5Json,
            'renewal_pending',
          ]
        );
      } catch (e) {
        console.error('Failed to create renewal payment record:', e);
        // Don't fail the whole request if payment record creation fails
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error(`Error updating payment ${params.id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { status } = body as { status: 'completed' | 'failed' };

    const { updateTransactionStatus } = await import('@/db/dbService');
    const result = await updateTransactionStatus(params.id, status, session.user.id);

    if (!result.success || !result.transaction) {
      return NextResponse.json({ error: 'Failed to update payment status' }, { status: 500 });
    }

    return NextResponse.json(result.transaction);
  } catch (error) {
    console.error(`Error updating payment ${params.id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}