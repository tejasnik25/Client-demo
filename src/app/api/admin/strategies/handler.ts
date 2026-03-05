import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getAllStrategies } from '@/db/dbService';

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const strategies = await getAllStrategies();
    return NextResponse.json({ strategies });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch strategies' }, { status: 500 });
  }
}
