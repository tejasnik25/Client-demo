import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { approveRunningStrategyModification } from '@/db/dbService';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const success = await approveRunningStrategyModification(params.id, session.user.id);
    if (!success) {
      return NextResponse.json({ error: 'Failed to approve modification' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Approval failed' }, { status: 500 });
  }
}
