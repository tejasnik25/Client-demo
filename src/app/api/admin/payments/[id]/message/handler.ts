import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '../../../auth';
import { setTransactionAdminMessage } from '@/db/dbService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await checkAdminAuth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { message } = body as { message?: string };
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    const updated = await setTransactionAdminMessage(params.id, session.user.id, message.trim(), 'pending');
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found or update failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to send message' },
      { status: 500 }
    );
  }
}