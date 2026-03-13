import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById, upsertMasterTrades, getCachedMasterTrades } from '@/db/dbService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 25;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const strategy = await getStrategyById(id);

  if (!strategy) {
    return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
  }

  const masterId = strategy.masterAccountId;
  if (!masterId) {
    console.error(`[MasterHistory] Master ID not found for strategy ${id}`);
    return NextResponse.json({ error: 'Master ID not found for this strategy' }, { status: 404 });
  }

  try {
    // [PUSH ARCHITECTURE REDESIGN]
    // The web application now reads EXCLUSIVELY from the database cache.
    // The Python trading service periodically PUSHES data to our sync endpoint.
    // This removes synchronous dependencies on the slow/unreliable AWS connection.
    
    console.log(`[MasterHistory] Reading cached data for master ${masterId}`);
    const cached = await getCachedMasterTrades(masterId);
    
    // Sort history by time_open descending
    const finalHistory = cached.history.sort((a, b) => {
      const getTime = (t: any) => {
        if (!t) return 0;
        if (t instanceof Date) return t.getTime();
        if (typeof t === 'number') return t > 10000000000 ? t : t * 1000;
        try { return new Date(t).getTime(); } catch { return 0; }
      };
      return getTime(b.time_open) - getTime(a.time_open);
    });

    const finalOpen = cached.open_positions;

    let errorStr: string | undefined = undefined;
    if (finalHistory.length === 0 && finalOpen.length === 0) {
      errorStr = "No trading data available in cache. Waiting for trading service to sync...";
    }

    return NextResponse.json({ 
      history: finalHistory, 
      open_positions: finalOpen, 
      error: errorStr,
      last_updated: cached.last_updated,
      info: "Data served from local database cache (Push Architecture)"
    });
  } catch (error: any) {
    console.error('[MasterHistory] Cache read error:', error);
    return NextResponse.json({ history: [], open_positions: [], error: 'Failed to read trade data from database' });
  }
}
