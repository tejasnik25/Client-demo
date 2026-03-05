
import { NextRequest, NextResponse } from 'next/server';
import { mt5Service, MtAccountDetails } from '@/lib/mt5-service';

/**
 * POST /api/copy-trading/connect
 * Validates an MT account connection.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, password, server, platform } = body;

    if (!id || !password || !server || !platform) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 400 });
    }

    const details: MtAccountDetails = { id, password, server, platform };
    const validation = await mt5Service.validateConnection(details);

    return NextResponse.json(validation);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
