import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getRunningStrategyById, updateRunningStrategyAdminStatus } from '@/db/dbService';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const running = await getRunningStrategyById(params.id);
    if (!running) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    // No slave credentials required for read-only display workflow.
    // Simply bump the updated_at timestamp by reasserting 'running' status.
    await updateRunningStrategyAdminStatus(params.id, 'running');
    return NextResponse.json({ success: true, message: 'Activation timestamp refreshed' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Reconnect failed' }, { status: 500 });
  }
}
