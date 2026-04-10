import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '../auth';
import {
  getProfitSharingOverviewAdmin,
  runProfitSharingSettlementAdmin,
  getProfitSharingUserSummaryAdmin,
  deleteRecentSettlementsAdmin,
} from '@/db/dbService';

export async function GET(req: NextRequest) {
  try {
    const session = await checkAdminAuth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const strategyId = new URL(req.url).searchParams.get('strategyId');
    const userId = new URL(req.url).searchParams.get('userId');

    if (strategyId) {
      const allStrategies = await getProfitSharingOverviewAdmin();
      const strategy = allStrategies.find(s => (s.id === strategyId || s.strategyId === strategyId));
      if (!strategy) return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
      
      return NextResponse.json({ strategy });
    }

    const view = new URL(req.url).searchParams.get('view');
    if (view === 'user-summary') {
      const users = await getProfitSharingUserSummaryAdmin();
      return NextResponse.json({ users });
    }

    const strategies = await getProfitSharingOverviewAdmin();
    return NextResponse.json({ strategies });
  } catch (error) {
    console.error('Profit-sharing GET failed:', error);
    return NextResponse.json({ error: 'Failed to load profit-sharing data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await checkAdminAuth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const strategyId = String(body?.strategyId || '').trim();
    const userId = body?.userId ? String(body?.userId).trim() : undefined;
    const action = body?.action || 'settle';

    if (!strategyId) {
      return NextResponse.json({ error: 'strategyId is required' }, { status: 400 });
    }

    if (action === 'reset') {
      const result = await deleteRecentSettlementsAdmin(strategyId, userId);
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Reset failed' }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: result.message });
    }

    const result = await runProfitSharingSettlementAdmin(strategyId, session.user.id, userId);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Settlement failed' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      settlementId: result.settlementId,
      items: result.items || [],
      message: result.message,
    });
  } catch (error) {
    console.error('Profit-sharing POST failed:', error);
    return NextResponse.json({ error: 'Failed to run settlement' }, { status: 500 });
  }
}
