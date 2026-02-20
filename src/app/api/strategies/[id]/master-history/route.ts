import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById } from '@/db/dbService';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const strategy = await getStrategyById(id);

  if (!strategy) {
    return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
  }

  const masterId = strategy.masterAccountId;
  if (!masterId) {
    return NextResponse.json({ error: 'Master ID not found for this strategy' }, { status: 404 });
  }

  const apiUrl = process.env.COPY_TRADING_API_URL || 'http://15.206.157.59:8000';
  const apiKey = process.env.COPY_TRADING_API_KEY || '9f236bab9fe640848a142f7d17a1960c8582d3ac18a96cc7ec86bb23c10ad6ad';

  // Helper mappers to normalize API variations
  const mapClosed = (p: any) => ({
    position_id: p.position_id ?? p.ticket ?? p.id ?? undefined,
    time_open: p.time_open ?? p.open_time ?? p.time ?? p.time_entry ?? undefined,
    time_close: p.time_close ?? p.close_time ?? p.time_exit ?? undefined,
    server_time_open: p.server_time_open ?? p.time_open_str ?? p.open_time_str ?? undefined,
    server_time_close: p.server_time_close ?? p.time_close_str ?? undefined,
    symbol: p.symbol ?? p.instrument ?? '',
    type: p.type ?? p.side ?? '',
    volume: p.volume ?? p.lots ?? p.volume_lots ?? 0,
    price_open: p.price_open ?? p.open ?? p.entry_price ?? 0,
    price_close: p.price_close ?? p.close ?? p.exit_price ?? p.price_current ?? 0,
    profit: Number(p.profit ?? p.pnl ?? 0),
  });
  const mapOpen = (p: any) => ({
    server_time: p.server_time ?? p.time_str ?? undefined,
    time: p.time ?? p.open_time ?? p.time_open ?? undefined,
    symbol: p.symbol ?? p.instrument ?? '',
    type: p.type ?? p.side ?? '',
    volume: p.volume ?? p.lots ?? p.volume_lots ?? 0,
    price_open: p.price_open ?? p.open ?? p.entry_price ?? 0,
    price_current: p.price_current ?? p.current_price ?? p.close ?? 0,
    profit: Number(p.profit ?? p.pnl ?? 0),
  });

  try {
    // Fetch closed positions
    const closedRes = await fetch(`${apiUrl}/master/${masterId}/history`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });

    // Fetch open positions (best-effort)
    const openResPromise = fetch(`${apiUrl}/master/${masterId}/open`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    }).catch(() => null as any);

    let history: any[] = [];
    let open_positions: any[] = [];
    let upstreamError: string | undefined = undefined;

    // Process closed
    if (closedRes.ok) {
      const closedJson = await closedRes.json().catch(() => null);
      if (Array.isArray(closedJson)) {
        history = closedJson.map(mapClosed);
      } else if (closedJson && typeof closedJson === 'object') {
        const rawClosed = closedJson.history ?? closedJson.closed_positions ?? closedJson.closed ?? closedJson.positions ?? [];
        if (Array.isArray(rawClosed)) {
          history = rawClosed.map(mapClosed);
        }
        const rawOpen = closedJson.open_positions ?? closedJson.open ?? [];
        if (Array.isArray(rawOpen)) {
          open_positions = rawOpen.map(mapOpen);
        }
      }
    } else {
      try {
        const err = await closedRes.json();
        upstreamError = err?.detail || String(closedRes.statusText || 'Failed to fetch history');
      } catch {
        upstreamError = String(closedRes.statusText || 'Failed to fetch history');
      }
    }

    // Process open from separate endpoint if we still have none
    try {
      const openRes = await openResPromise;
      if (openRes && openRes.ok) {
        const openJson = await openRes.json().catch(() => null);
        const rawOpen = Array.isArray(openJson)
          ? openJson
          : (openJson?.open_positions ?? openJson?.open ?? []);
        if (Array.isArray(rawOpen)) {
          open_positions = rawOpen.map(mapOpen);
        }
      }
    } catch { /* ignore */ }

    return NextResponse.json({ history, open_positions, error: upstreamError });
  } catch (error: any) {
    console.error('Error fetching master history:', error);
    // Return soft-OK with empty arrays so UI still renders
    return NextResponse.json({ history: [], open_positions: [], error: 'Connection to trading service failed' });
  }
}
