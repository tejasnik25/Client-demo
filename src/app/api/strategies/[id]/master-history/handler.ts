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
    
    return {
      position_id: String(p.position_id ?? p.ticket ?? p.id ?? ''),
      time_open: p.time_open ?? p.open_time ?? p.time ?? p.time_entry ?? undefined,
      time_close: p.time_close ?? p.close_time ?? p.time_exit ?? undefined,
      server_time_open: p.server_time_open ?? p.time_open_str ?? p.open_time_str ?? undefined,
      server_time_close: p.server_time_close ?? p.time_close_str ?? undefined,
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

    return {
      position_id: String(p.position_id ?? p.ticket ?? p.id ?? ''),
      server_time: p.server_time ?? p.time_str ?? undefined,
      time: p.time ?? p.open_time ?? p.time_open ?? undefined,
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
    const PER_REQ_TIMEOUT_MS = 4000;
    
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
      `/masters/${masterId}/history`,
      `/master/${masterId}/positions/closed`,
      `/master/${masterId}/trades/closed`,
    ];
    const pathsOpen = [
      `/master/${masterId}/open`,
      `/masters/${masterId}/open`,
      `/master/${masterId}/positions/open`,
      `/master/${masterId}/positions`,
    ];

    let history: any[] = [];
    let open_positions: any[] = [];

    // Parallelize all primary paths to reduce delay significantly
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

    // Deduplicate fresh history and open_positions
    const freshHistoryMap = new Map();
    history.forEach(t => freshHistoryMap.set(t.position_id, t));
    history = Array.from(freshHistoryMap.values());

    const freshOpenMap = new Map();
    open_positions.forEach(t => freshOpenMap.set(t.position_id, t));
    open_positions = Array.from(freshOpenMap.values());

    // CRITICAL: A trade cannot be in both history and open_positions.
    // If it's in history (closed), remove it from open_positions.
    open_positions = open_positions.filter(op => !freshHistoryMap.has(op.position_id));

    // Check if provider fetch was successful
    const anyFetchSuccess = results.some(r => r.status === 'fulfilled' && r.value.ok);

    // Persist to temporary storage (MySQL Cache) before returning
    // We prioritize fresh data. If we have fresh history, we upsert it.
    if (history.length > 0) {
      console.log(`[MasterHistory] Upserting ${history.length} closed trades for ${masterId}`);
      await upsertMasterTrades(masterId, history, false);
    }
    
    // For open positions, we ALWAYS upsert if fetch was successful, even if 0.
    // This ensures that if a trade was closed on MT5, it gets cleared from our 'open' cache.
    if (anyFetchSuccess) {
      console.log(`[MasterHistory] Updating ${open_positions.length} open positions for ${masterId}`);
      await upsertMasterTrades(masterId, open_positions, true);
    }

    // Always merge with cached data to ensure completeness
    const cached = await getCachedMasterTrades(masterId);
    console.log(`[MasterHistory] Cache for ${masterId}: ${cached.history.length} closed, ${cached.open_positions.length} open`);
    
    // Create map for deduplication, preferring fresh data
    const historyMap = new Map();
    cached.history.forEach(t => historyMap.set(t.position_id, t));
    history.forEach(t => historyMap.set(t.position_id, t));
    
    const openMap = new Map();
    // For open positions, we only want the ones currently reported as open by MT5
    // But if fetch failed completely, we fallback to cache
    if (open_positions.length > 0) {
      open_positions.forEach(t => openMap.set(t.position_id, t));
    } else if (anyFetchSuccess) {
      // If MT5 says 0 open positions and fetch was successful, then 0 are open.
    } else {
      // If fetch failed, show last known open positions from cache
      cached.open_positions.forEach(t => openMap.set(t.position_id, t));
    }

    const finalHistory = Array.from(historyMap.values()).sort((a, b) => (b.time_open || 0) - (a.time_open || 0));
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
