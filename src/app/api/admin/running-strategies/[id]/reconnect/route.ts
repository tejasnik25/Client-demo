import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getRunningStrategyById, getStrategyById } from '@/db/dbService';
import { mt5Service, MtAccountDetails } from '@/lib/mt5-service';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const running = await getRunningStrategyById(params.id);
    if (!running) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    const strategy = await getStrategyById(running.strategyId);
    if (!strategy || !(strategy as any).masterAccountId) {
      return NextResponse.json({ error: 'Master details missing' }, { status: 400 });
    }

    const master: MtAccountDetails = {
      id: (strategy as any).masterAccountId,
      password: (strategy as any).masterAccountPassword || '',
      server: (strategy as any).masterAccountServer || '',
      platform: (((strategy as any).masterPlatform || 'MT5') as string).toUpperCase() === 'MT4' ? 'MT4' : 'MT5',
    };
    const slave: MtAccountDetails = {
      id: (running as any).mtAccountId || '',
      password: (running as any).mtAccountPassword || '',
      server: (running as any).mtAccountServer || '',
      platform: (((running as any).platform || 'MT5') as string).toUpperCase() === 'MT4' ? 'MT4' : 'MT5',
    };

    if (!slave.id || !slave.password) {
      return NextResponse.json({ error: 'Slave credentials missing' }, { status: 400 });
    }

    await mt5Service.startCopyTrading(master, slave, params.id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Reconnect failed' }, { status: 500 });
  }
}
