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
    const TOTAL_BUDGET_MS = 20000;
    const PER_REQ_TIMEOUT_MS = 12000; // Increased to 12s for MT5 stability
    
    const timedFetch = async (url: string, init?: RequestInit) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), PER_REQ_TIMEOUT_MS);
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(id);
        return res;
      } catch (e) {
        clearTimeout(id);
        throw e;
      }
    };

    const pathsClosed = [
      `/master/${masterId}/history`,
    ];
    const pathsOpen = [
      `/master/${masterId}/open`,
    ];

    let history: any[] = [];
    let open_positions: any[] = [];

    // We only need to fetch the primary history route now, as it returns both history and open positions.
    // The separate /open route is kept as a fallback if the main one fails.
    const primaryPath = `/master/${masterId}/history`;
    
    try {
      const response = await timedFetch(`${apiUrl}${primaryPath}`, { 
        headers: { Authorization: `Bearer ${apiKey}` }, 
        cache: 'no-store' 
      });
      
      if (response.ok) {
        const json = await response.json().catch(() => null);
        if (json) {
          // New optimized route returns both
          if (json.history && Array.isArray(json.history)) {
            history = json.history.map(mapClosed);
          }
          if (json.open_positions && Array.isArray(json.open_positions)) {
            open_positions = json.open_positions.map(mapOpen);
          }
          
          // Legacy support for plain arrays
          if (Array.isArray(json)) {
             const isHistory = json.length > 0 && ('time_close' in json[0] || 'close_time' in json[0] || 'price_close' in json[0]);
             if (isHistory) history = json.map(mapClosed);
             else open_positions = json.map(mapOpen);
          }
        }
      }
    } catch (e) {
      console.warn(`[MasterHistory] Primary fetch failed for ${masterId}:`, e);
    }

    // Fallback parallel fetch if we still have nothing
    if (history.length === 0 && open_positions.length === 0) {
      const allPaths = [...pathsClosed, ...pathsOpen];
      const results = await Promise.allSettled(
        allPaths.map(p => timedFetch(`${apiUrl}${p}`, { 
          headers: { Authorization: `Bearer ${apiKey}` }, 
          cache: 'no-store' 
        }))
      );
      
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'fulfilled' && r.value.ok) {
          const json = await r.value.json().catch(() => null);
          if (!json) continue;

          if (Array.isArray(json)) {
            const isHistory = json.length > 0 && ('time_close' in json[0] || 'close_time' in json[0] || 'price_close' in json[0]);
            if (isHistory) {
              const mapped = json.map(mapClosed);
              history = [...history, ...mapped];
            } else {
              const mapped = json.map(mapOpen);
              open_positions = [...open_positions, ...mapped];
            }
          } else {
            const extract = (obj: any, keys: string[]) => {
              for (const k of keys) {
                if (Array.isArray(obj[k])) return obj[k];
                if (obj.data && Array.isArray(obj.data[k])) return obj.data[k];
              }
              return null;
            };

            const hRaw = extract(json, ['history', 'closed_positions', 'closed', 'trades', 'results']);
            const oRaw = extract(json, ['open_positions', 'open', 'positions', 'results']);
            
            if (hRaw) history = [...history, ...hRaw.map(mapClosed)];
            if (oRaw) open_positions = [...open_positions, ...oRaw.map(mapOpen)];
          }
        }
      }
    }

    // Check if any fetch was successful (either primary or fallbacks)
    const anyFetchSuccess = history.length > 0 || open_positions.length > 0;

    // Persist to temporary storage (MySQL Cache) before returning
    // We prioritize fresh data. If we have fresh history, we upsert it.
    if (history.length > 0) {
      console.log(`[MasterHistory] Upserting ${history.length} closed trades for ${masterId}`);
      await upsertMasterTrades(masterId, history, false);
    }
    
    // For open positions, we prefer to keep the last-known cache when the API returns zero
    // (this can happen due to transient service failures or partial data). We only overwrite
    // the cache when we get a non-empty list of open positions.
    if (anyFetchSuccess) {
      if (open_positions.length > 0) {
        console.log(`[MasterHistory] Updating ${open_positions.length} open positions for ${masterId}`);
        await upsertMasterTrades(masterId, open_positions, true);
      } else {
        console.log(`[MasterHistory] API returned 0 open positions for ${masterId}; retaining cached open positions.`);
      }
    }

    // Always merge with cached data to ensure completeness
    const cached = await getCachedMasterTrades(masterId);
    console.log(`[MasterHistory] Cache for ${masterId}: ${cached.history.length} closed, ${cached.open_positions.length} open`);
    
    // Create map for deduplication, preferring fresh data
    const historyMap = new Map();
    cached.history.forEach(t => historyMap.set(String(t.position_id), t));
    history.forEach(t => historyMap.set(String(t.position_id), t));
    
    const openMap = new Map();
    // Start with the cached open positions so we can fall back when the API returns partial/empty results.
    // This ensures the UI can still show the last-known open trades when the trading service is flaky.
    cached.open_positions.forEach(t => openMap.set(String(t.position_id), t));

    // Merge in any fresh open positions from the API responses (overwrites cached entries with the same position_id).
    // If the fetch succeeded but returns 0 open positions, we'll keep the cached ones to avoid accidentally wiping them.
    open_positions.forEach(t => openMap.set(String(t.position_id), t));

    // Remove any open positions that are now marked as closed in history
    const closedPositionIds = new Set(Array.from(historyMap.values()).map(t => String(t.position_id)));
    for (const closedId of closedPositionIds) {
      openMap.delete(closedId);
    }

    const finalHistory = Array.from(historyMap.values()).sort((a, b) => {
      const getTime = (t: any) => {
        if (!t) return 0;
        if (t instanceof Date) return t.getTime();
        if (typeof t === 'number') return t > 10000000000 ? t : t * 1000; // Handle seconds vs milliseconds
        try { return new Date(t).getTime(); } catch { return 0; }
      };
      return getTime(b.time_open) - getTime(a.time_open);
    });
    const finalOpen = Array.from(openMap.values());

    // Only surface error if we found absolutely nothing even in cache
    let errorStr: string | undefined = undefined;
    if (finalHistory.length === 0 && finalOpen.length === 0) {
      // Don't show error immediately, try to provide helpful context
      console.warn(`[MasterHistory] No trades found for master ${masterId}. This could mean:
        1. Master account has no open/closed trades
        2. Trading service is temporarily unavailable
        3. Master account ID is incorrect or account is inactive`);
      
      // Only show error if we have no cache at all
      if (cached.history.length === 0 && cached.open_positions.length === 0) {
        errorStr = "No trading data available. The master account may have no trades or the trading service is temporarily unavailable.";
      }
    } else if (!anyFetchSuccess) {
      // If provider failed but we have cache, don't show error, just a warning in logs
      console.warn(`[MasterHistory] Provider offline for ${masterId}. Serving ${finalHistory.length + finalOpen.length} trades from cache.`);
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
