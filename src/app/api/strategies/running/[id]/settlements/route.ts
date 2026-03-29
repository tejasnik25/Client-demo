import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getSettlementsByUserAndStrategy, getRunningStrategyById } from '@/db/dbService';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rsId } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rs = await getRunningStrategyById(rsId);
    if (!rs) {
      return NextResponse.json({ error: 'Running strategy not found' }, { status: 404 });
    }

    const settlements = await getSettlementsByUserAndStrategy(rs.userId, rs.strategyId);
    return NextResponse.json({ settlements });
  } catch (error: any) {
    console.error('Error fetching user settlements:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch settlements' }, { status: 500 });
  }
}
