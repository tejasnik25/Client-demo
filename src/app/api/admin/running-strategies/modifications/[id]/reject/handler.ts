import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { rejectRunningStrategyModification } from '@/db/dbService';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const reason = body.rejectionReason || 'No reason provided';

    const success = await rejectRunningStrategyModification(params.id, reason);
    if (!success) {
      return NextResponse.json({ error: 'Failed to reject modification' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Rejection failed' }, { status: 500 });
  }
}
