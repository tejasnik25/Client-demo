import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '../auth';
import { syncJsonToMysql } from '@/db/dbService';

export async function POST(_req: NextRequest) {
  try {
    const session = await checkAdminAuth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = await syncJsonToMysql();
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Sync failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, inserted: result.inserted, skipped: result.skipped });
  } catch (error) {
    console.error('Error during JSON→MySQL sync:', error);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}