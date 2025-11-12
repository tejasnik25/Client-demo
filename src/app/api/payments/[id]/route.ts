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
    const { txId, proofUrl, status } = body as { txId: string; proofUrl: string; status?: 'pending'|'in-process'|'completed'|'failed' };

    const { updateTransactionProof } = await import('@/db/dbService');
    const updated = await updateTransactionProof(params.id, txId, proofUrl, status ?? 'in-process');

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
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