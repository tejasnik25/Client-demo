
import { NextRequest, NextResponse } from 'next/server';
import { mt5Service, MtAccountDetails } from '@/lib/mt5-service';

/**
 * POST /api/copy-trading/subscribe
 * Starts copying from Master to Slave.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { master, slave, runningStrategyId } = body;

    if (!master || !slave || !runningStrategyId) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const res = await mt5Service.startCopyTrading(
      master as MtAccountDetails,
      slave as MtAccountDetails,
      runningStrategyId
    );

    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
