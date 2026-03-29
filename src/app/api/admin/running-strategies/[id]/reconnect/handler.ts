import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getRunningStrategyById, updateRunningStrategyAdminStatus, startRunningPeriod } from '@/db/dbService';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const running = await getRunningStrategyById(params.id);
    if (!running) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    
    // Reset to running status
    await updateRunningStrategyAdminStatus(params.id, 'running');
    // Also start a new running period
    await startRunningPeriod(params.id);
    
    return NextResponse.json({ success: true, message: 'Activation timestamp refreshed and running period started' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Reconnect failed' }, { status: 500 });
  }
}
