import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getRunningStrategiesAdmin } from '@/db/dbService';

async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') return null;
  return session;
}

export async function GET(_req: NextRequest) {
  try {
    const session = await checkAdminAuth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const items = await getRunningStrategiesAdmin();
    return NextResponse.json({ strategies: items });
  } catch (error) {
    console.error('Error fetching admin running strategies:', error);
    return NextResponse.json({ error: 'Failed to fetch strategies' }, { status: 500 });
  }
}