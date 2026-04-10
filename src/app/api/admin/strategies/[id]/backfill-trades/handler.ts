import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '../../../auth';
import { getStrategyById, getCachedMasterTrades } from '@/db/dbService';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await checkAdminAuth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const strategyId = params.id;
    const strategy = await getStrategyById(strategyId);
    if (!strategy || !strategy.masterAccountId) {
      return NextResponse.json({ error: 'Strategy or master account not found' }, { status: 404 });
    }

    const baseUrl =
      process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://127.0.0.1:3000');

    const url = `${baseUrl}/api/strategies/${encodeURIComponent(strategyId)}/master-history?t=${Date.now()}`;
    const r = await fetch(url, { cache: 'no-store' });
    const data = await r.json();

    const cached = await getCachedMasterTrades(strategy.masterAccountId);
    const historyCount = Array.isArray(cached.history) ? cached.history.length : 0;
    const openCount = Array.isArray(cached.open_positions) ? cached.open_positions.length : 0;

    return NextResponse.json({
      success: true,
      fetched: r.ok,
      strategyId,
      masterId: strategy.masterAccountId,
      cachedHistory: historyCount,
      cachedOpen: openCount,
      info: data?.info || null,
      error: r.ok ? undefined : data?.error || 'Fetch failed',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Backfill failed' }, { status: 500 });
  }
}
