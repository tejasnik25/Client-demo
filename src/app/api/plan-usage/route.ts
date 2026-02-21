import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { db } from '@/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const [rows] = await db.query('SELECT * FROM plan_usage_report');
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching plan usage report:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
