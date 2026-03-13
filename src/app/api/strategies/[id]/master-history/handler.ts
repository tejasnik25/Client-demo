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

  console.log(`[MasterHistory] Fetching history for master ${masterId} (Strategy: ${id})`);

  // Resolve provider URL similar to copy-trading-service
  let apiUrl =
    process.env.COPY_TRADING_API_URL ||
    process.env.COPY_TRADING_URL ||
    process.env.NEXT_PUBLIC_COPY_TRADING_API_URL ||
    process.env.NEXT_PUBLIC_COPY_TRADING_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000' : 'http://15.206.157.59:8000');
  if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
  const apiKey =
    process.env.COPY_TRADING_API_KEY ||
    process.env.NEXT_PUBLIC_COPY_TRADING_API_KEY ||
    '9f236bab9fe640848a142f7d17a1960c8582d3ac18a96cc7ec86bb23c10ad6ad';

  const mapClosed = (p: any) => {
    const rawType = p.type ?? p.side ?? '';
    // MT5: 0=Buy, 1=Sell. Others might use "buy"/"sell" strings.
    const type = (String(rawType).toLowerCase().includes('buy') || rawType === 0 || rawType === '0') ? 'BUY' : 
                 (String(rawType).toLowerCase().includes('sell') || rawType === 1 || rawType === '1') ? 'SELL' : String(rawType).toUpperCase();
    
    // Ensure time is in ISO format for MySQL
    const formatTime = (t: any) => {
      // A timestamp of 0 is technically epoch time, but in this context, it often represents a missing or invalid date.
      if (t === null || t === undefined || t === 0) return null;
      try {
        // Handle unix timestamps (seconds or ms) and date strings
        const d = new Date(typeof t === 'number' && t < 100000000000 ? t * 1000 : t);
        // Check for invalid date
        if (isNaN(d.getTime())) return null;
        return d.toISOString();
      } catch (e) {
        return null;
      }
    };

    return {
      position_id: String(p.position_id ?? p.ticket ?? p.id ?? ''),
      time_open: formatTime(p.time_open ?? p.open_time ?? p.time ?? p.time_entry ?? p.server_time_open),
      time_close: formatTime(p.time_close ?? p.close_time ?? p.time_exit ?? p.server_time_close),
      server_time_open: p.server_time_open ?? p.time_open_str ?? p.open_time_str ?? p.time ?? undefined,
      server_time_close: p.server_time_close ?? p.time_close_str ?? p.close_time_str ?? p.time ?? undefined,
      symbol: p.symbol ?? p.instrument ?? '',
      type,
      volume: p.volume ?? p.lots ?? p.volume_lots ?? 0,
      price_open: p.price_open ?? p.open ?? p.entry_price ?? 0,
      price_close: p.price_close ?? p.close ?? p.exit_price ?? p.price_current ?? 0,
      profit: Number(p.profit ?? p.pnl ?? 0),
      swap: Number(p.swap ?? 0),
    };
  };

  const mapOpen = (p: any) => {
    const rawType = p.type ?? p.side ?? '';
    const type = (String(rawType).toLowerCase().includes('buy') || rawType === 0 || rawType === '0') ? 'BUY' : 
                 (String(rawType).toLowerCase().includes('sell') || rawType === 1 || rawType === '1') ? 'SELL' : String(rawType).toUpperCase();

    // Ensure time is in ISO format for MySQL
    const formatTime = (t: any) => {
      if (!t) return undefined;
      if (typeof t === 'number') {
        // MT5 timestamps are in seconds, JS needs milliseconds
        return new Date(t * 1000).toISOString();
      }
      return new Date(t).toISOString();
    };

    return {
      position_id: String(p.position_id ?? p.ticket ?? p.id ?? ''),
      server_time: p.server_time ?? p.time_str ?? undefined,
      time: formatTime(p.time ?? p.open_time ?? p.time_open ?? p.server_time ?? p.server_time_open),
      symbol: p.symbol ?? p.instrument ?? '',
      type,
      volume: p.volume ?? p.lots ?? p.volume_lots ?? 0,
      price_open: p.price_open ?? p.open ?? p.entry_price ?? 0,
      price_current: p.price_current ?? p.current_price ?? p.close ?? 0,
      profit: Number(p.profit ?? p.pnl ?? 0),
      swap: Number(p.swap ?? 0),
    };
  };

  try {
    const started = Date.now();
    
    // 1. FAST CACHE FETCH (Architecture: Fast-First)
    // Always get what we already have in the database first.
    const cached = await getCachedMasterTrades(masterId);
    console.log(`[MasterHistory] DB Cache for ${masterId}: ${cached.history.length} closed, ${cached.open_positions.length} open`);

    // 2. DETERMINE IF WE NEED A LIVE REFRESH
    // If we have no data, or if we want to try a refresh, we prepare the fetch.
    // We use a much tighter timeout to prevent Vercel 30s timeouts.
    const LIVE_FETCH_TIMEOUT = cached.history.length > 0 ? 5000 : 15000; // 5s if we have cache, 15s if we don't
    
    const timedFetch = async (url: string, timeout: number, init?: RequestInit) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(id);
        return res;
      } catch (e) {
        clearTimeout(id);
        throw e;
      }
    };

    let history: any[] = [];
    let open_positions: any[] = [];
    let fetchError = false;

    // Trigger live fetch
    const primaryPath = `/master/${masterId}/history`;
    try {
      const response = await timedFetch(`${apiUrl}${primaryPath}`, LIVE_FETCH_TIMEOUT, { 
        headers: { Authorization: `Bearer ${apiKey}` }, 
        cache: 'no-store' 
      });
      
      if (response.ok) {
        const json = await response.json().catch(() => null);
        if (json) {
          if (json.history && Array.isArray(json.history)) history = json.history.map(mapClosed);
          if (json.open_positions && Array.isArray(json.open_positions)) open_positions = json.open_positions.map(mapOpen);
        }
      } else {
        fetchError = true;
      }
    } catch (e: any) {
      console.warn(`[MasterHistory] Live fetch failed or timed out for ${masterId} (${e.name === 'AbortError' ? 'Timeout' : 'Error'})`);
      fetchError = true;
    }

    // 3. DATA MERGING & DEDUPLICATION
    // We merge fresh data with cached data, preferring fresh data.
    const historyMap = new Map();
    cached.history.forEach(t => historyMap.set(String(t.position_id), t));
    history.forEach(t => historyMap.set(String(t.position_id), t));
    
    const openMap = new Map();
    cached.open_positions.forEach(t => openMap.set(String(t.position_id), t));
    open_positions.forEach(t => openMap.set(String(t.position_id), t));

    // Cleanup: Remove any open positions that are now definitively closed in history
    const closedPositionIds = new Set(Array.from(historyMap.values()).map(t => String(t.position_id)));
    for (const closedId of closedPositionIds) {
      openMap.delete(closedId);
    }

    const finalHistory = Array.from(historyMap.values()).sort((a, b) => {
      const getTime = (t: any) => {
        if (!t) return 0;
        if (t instanceof Date) return t.getTime();
        if (typeof t === 'number') return t > 10000000000 ? t : t * 1000;
        try { return new Date(t).getTime(); } catch { return 0; }
      };
      return getTime(b.time_open) - getTime(a.time_open);
    });
    const finalOpen = Array.from(openMap.values());

    // 4. PERSIST FRESH DATA TO DB (ASYNCHRONOUSLY)
    // We don't 'await' these so we can return the response faster
    if (history.length > 0) upsertMasterTrades(masterId, history, false).catch(e => console.error('[DB] History upsert failed:', e));
    if (open_positions.length > 0) upsertMasterTrades(masterId, open_positions, true).catch(e => console.error('[DB] Open positions upsert failed:', e));

    // 5. FINAL RESPONSE
    let errorStr: string | undefined = undefined;
    if (finalHistory.length === 0 && finalOpen.length === 0) {
      errorStr = fetchError 
        ? "Connection to trading service failed. No cached data available." 
        : "No trading data found for this master account.";
    }

    return NextResponse.json({ 
      history: finalHistory, 
      open_positions: finalOpen, 
      error: errorStr 
    });
  } catch (error: any) {
    console.error('Error fetching master history:', error);
    return NextResponse.json({ history: [], open_positions: [], error: 'Connection to trading service failed' });
  }
}
