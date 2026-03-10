import { NextRequest, NextResponse } from 'next/server';
import { GET as getMasterHistory } from './handler';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return getMasterHistory(req, { params });
}
