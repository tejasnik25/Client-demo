import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '../auth';
import { getAllSettlements } from '@/db/dbService';

export async function GET(req: NextRequest) {
  try {
    const session = await checkAdminAuth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settlements = await getAllSettlements();
    return NextResponse.json({ settlements });
  } catch (error: any) {
    console.error('Error fetching all settlements:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch all settlements' }, { status: 500 });
  }
}
