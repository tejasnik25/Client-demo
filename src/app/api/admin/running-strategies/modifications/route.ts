import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getRunningStrategyModificationsAdmin } from '@/db/dbService';

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const modifications = await getRunningStrategyModificationsAdmin();
    return NextResponse.json({ modifications });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch modifications' }, { status: 500 });
  }
}