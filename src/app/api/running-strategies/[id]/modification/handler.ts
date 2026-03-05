import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { 
  createRunningStrategyModification, 
  updateRunningStrategyAdminStatus,
  getRunningStrategyById,
  createDisconnectSnapshot
} from '@/db/dbService';
import { v4 as uuidv4 } from 'uuid';
import { mt5Service } from '@/lib/mt5-service';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'USER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as any)?.id;
  const body = await req.json().catch(() => ({}));

  // 1. Fetch Running Strategy
  const runningStrategy = await getRunningStrategyById(params.id);
  if (!runningStrategy) {
    return NextResponse.json({ error: 'Running strategy not found' }, { status: 404 });
  }

  // Only action-based flow remains (no slave details or validation)
  if (body.action === 'disconnect') {
    // User requests disconnect -> move to in-process for admin review
    await updateRunningStrategyAdminStatus(params.id, 'in-process');
    // Record modification request
    const modPayload: any = {
        id: uuidv4(),
        running_strategy_id: params.id,
        user_id: userId,
        status: 'in-process',
        new_update_json: { action: 'disconnect' },
    };
    await createRunningStrategyModification(modPayload);
    // Snapshot open positions at the moment of disconnect for accurate P&L
    try {
      const snapshot = await mt5Service.getOpenPositions(params.id);
      await createDisconnectSnapshot({
        id: uuidv4(),
        running_strategy_id: params.id,
        user_id: userId,
        positions: snapshot?.positions || []
      });
    } catch {}
    // Immediately stop copying and close all open positions
    try {
      await mt5Service.stopCopyTrading(params.id);
    } catch {}
    try {
      await mt5Service.closeAllPositions(params.id);
    } catch {}
    return NextResponse.json({ success: true, status: 'in-process' });
  }
  
  if (body.action === 'enable') {
     // User requests connect -> move to in-process for admin review
     await updateRunningStrategyAdminStatus(params.id, 'in-process');
     const modPayload: any = {
       id: uuidv4(),
       running_strategy_id: params.id,
       user_id: userId,
       status: 'in-process',
       new_update_json: { action: 'enable' },
     };
     await createRunningStrategyModification(modPayload);
     return NextResponse.json({ success: true, status: 'in-process' });
  }

  // Other types of updates are no longer supported (no slave details management)
  return NextResponse.json({ error: 'Only action-based requests are supported' }, { status: 400 });
}
