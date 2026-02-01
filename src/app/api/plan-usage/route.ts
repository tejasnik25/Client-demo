import { NextResponse } from 'next/server';
import { db } from '@/db';

export async function GET() {
  try {
    const [rows] = await db.query('SELECT * FROM plan_usage_report');
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching plan usage report:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}