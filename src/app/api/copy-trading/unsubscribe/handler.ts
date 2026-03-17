
import { NextRequest, NextResponse } from 'next/server';
import { mt5Service } from '@/lib/mt5-service';

/**
 * POST /api/copy-trading/unsubscribe
 * Stops copying.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { runningStrategyId } = body;

    if (!runningStrategyId) {
      return NextResponse.json({ success: false, error: 'Missing runningStrategyId' }, { status: 400 });
    }

    const res = await mt5Service.stopCopyTrading(runningStrategyId);
    return NextResponse.json(res);
  } catch (error: any) {
    console.error('[CopyTrading] Unsubscribe failed:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
