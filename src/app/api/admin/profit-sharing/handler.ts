import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '../auth';
import {
  getProfitSharingOverviewAdmin,
  runProfitSharingSettlementAdmin,
  getProfitSharingUserSummaryAdmin,
} from '@/db/dbService';

export async function GET(req: NextRequest) {
  try {
    const session = await checkAdminAuth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const strategyId = new URL(req.url).searchParams.get('strategyId');
    if (strategyId) {
      const allStrategies = await getProfitSharingOverviewAdmin();
      const strategy = allStrategies.find(s => s.strategyId === strategyId);
      if (!strategy) return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
      
      // Also get detailed users list for this strategy if needed
      // For now, let's just return the strategy overview
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
    if (!strategyId) {
      return NextResponse.json({ error: 'strategyId is required' }, { status: 400 });
    }

    const result = await runProfitSharingSettlementAdmin(strategyId, session.user.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Settlement failed' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      settlement: result.settlement,
      items: result.items || [],
    });
  } catch (error) {
    console.error('Profit-sharing POST failed:', error);
    return NextResponse.json({ error: 'Failed to run settlement' }, { status: 500 });
  }
}
