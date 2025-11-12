import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getRunningStrategiesForUser } from '@/db/dbService';

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const strategies = await getRunningStrategiesForUser(session.user.id);
    return NextResponse.json(strategies);
  } catch (error) {
    console.error('Error fetching running strategies:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}