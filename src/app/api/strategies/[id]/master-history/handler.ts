import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById, getCachedMasterTrades, upsertMasterTrades, reconcileMasterOpenPositions } from '@/db/dbService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 25;

const PYTHON_SERVICE_TIMEOUT_MS = 20000;

function getTradingServiceBaseUrl(): string {
  const envUrl =
    process.env.COPY_TRADING_API_URL ||
    process.env.COPY_TRADING_URL ||
    process.env.NEXT_PUBLIC_COPY_TRADING_API_URL ||
    process.env.NEXT_PUBLIC_COPY_TRADING_URL;
  if (envUrl && !envUrl.includes('mock')) return envUrl.replace(/\/$/, '');
  return process.env.NODE_ENV === 'production'
    ? 'http://15.206.157.59:8000'
    : 'http://127.0.0.1:8000';
}

/**
 * Master trade history: prefer live MT5 via Python service, but fall back to cached
 * DB data if live fetch fails (network down, MT5 down, wrong password, etc.).
 *
 * This supports:
 * - Show last known trades immediately
 * - Background refresh when service is available
 * - Never crash / never show connection errors to end users when we have old data
 */
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

  const normalizeCachedTrade = (trade: any) => ({
    position_id: trade.position_id ?? trade.ticket ?? trade.id,
    symbol: trade.symbol,
    type: trade.type,
    volume: Number(trade.volume || 0),
    price_open: Number(trade.price_open || trade.price || 0),
    price_close: Number(trade.price_close || 0),
    price_current: Number((trade.price_current ?? trade.price_close ?? trade.price) || 0),
    profit: Number(trade.profit || 0),
    swap: Number(trade.swap || 0),
    commission: Number(trade.commission || 0),
    time_open: trade.time_open || trade.server_time_open || trade.time || null,
    time_close: trade.time_close || trade.server_time_close || null,
    server_time_open: trade.server_time_open || trade.time_open || trade.server_time || null,
    server_time_close: trade.server_time_close || trade.time_close || null,
  });

  const fallbackFromCache = async (reason?: string) => {
    try {
      const cached = await getCachedMasterTrades(masterId);
      const hist = Array.isArray(cached.history) ? cached.history.map(normalizeCachedTrade) : [];
      const open = Array.isArray(cached.open_positions) ? cached.open_positions.map(normalizeCachedTrade) : [];
      if (hist.length === 0 && open.length === 0) {
        return NextResponse.json({
          history: [],
          open_positions: [],
          error: reason || 'No trading data available yet.',
          last_updated: cached.last_updated,
          info: 'No cached data available',
        });
      }
      return NextResponse.json({
        history: hist,
        open_positions: open,
        // Do not show connection errors to end users if we have old data.
        error: undefined,
        last_updated: cached.last_updated,
        info: 'Served cached data (live fetch failed)',
      });
    } catch {
      return NextResponse.json({
        history: [],
        open_positions: [],
        error: reason || 'Failed to load trading data.',
        last_updated: new Date().toISOString(),
        info: 'Cache and live fetch failed',
      });
    }
  };

  const apiKey = (process.env.COPY_TRADING_API_KEY || '').trim();
  if (!apiKey) {
    // If the server is missing the key, serve cached data instead of erroring.
    console.warn('[MasterHistory] COPY_TRADING_API_KEY missing/empty; serving cached data');
    return fallbackFromCache();
  }

  const cached = await getCachedMasterTrades(masterId);
  const cachedHist = Array.isArray(cached.history) ? cached.history.map(normalizeCachedTrade) : [];
  const cachedOpen = Array.isArray(cached.open_positions) ? cached.open_positions.map(normalizeCachedTrade) : [];

  if (cachedHist.length > 0 || cachedOpen.length > 0) {
    // Return cached immediately on prod to avoid 30s function timeout while trying to reach an unstable remote.
    void (async () => {
      try {
        const baseUrl = getTradingServiceBaseUrl();
        const liveUrl = `${baseUrl}/master/${encodeURIComponent(masterId)}/history`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), Math.min(PYTHON_SERVICE_TIMEOUT_MS, 9000));

        const res = await fetch(liveUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) return;

        const data = await res.json();
        const history = Array.isArray(data.history) ? data.history : [];
        const open_positions = (Array.isArray(data.open_positions) ? data.open_positions : []).map((p: any) => ({
          ...p,
          server_time_open: p.server_time_open ?? p.server_time ?? null,
          price_current: p.price_current ?? p.price ?? p.price_open ?? null,
        }));

        // Do local cache refresh in background if we have new data
        const finalHistory = history;
        const finalOpenPositions = open_positions;
        if (finalHistory.length > 0) {
          await upsertMasterTrades(masterId, finalHistory, false);
        }
        await reconcileMasterOpenPositions(masterId, finalOpenPositions);
      } catch (err) {
        console.warn('[MasterHistory] Background refresh failed:', err);
      }
    })();

    return NextResponse.json({
      history: cachedHist,
      open_positions: cachedOpen,
      error: undefined,
      last_updated: cached.last_updated,
      info: 'Serving cached data while live refresh is in progress',
    });
  }

  const baseUrl = getTradingServiceBaseUrl();
  const liveUrl = `${baseUrl}/master/${encodeURIComponent(masterId)}/history`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PYTHON_SERVICE_TIMEOUT_MS);

    const res = await fetch(liveUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      console.warn(`[MasterHistory] Live fetch failed ${res.status} for master ${masterId}: ${text}`);
      return fallbackFromCache();
    }

    const data = (await res.json()) as {
      master_id?: string;
      history?: any[];
      open_positions?: any[];
      error?: string;
    };

    const history = Array.isArray(data.history) ? data.history : [];
    const open_positions = (Array.isArray(data.open_positions) ? data.open_positions : []).map(
      (p: any) => ({
        ...p,
        server_time_open: p.server_time_open ?? p.server_time ?? null,
        price_current: p.price_current ?? p.price ?? p.price_open ?? null,
      })
    );

    // Merge with cached DB history to avoid missing trades if either
    // the live MT5 endpoint or the push-based sync lags behind.
    let mergedHistory = [...history];
    let mergedOpen = [...open_positions];
    try {
      const cached = await getCachedMasterTrades(masterId);
      const cachedHistory = Array.isArray(cached.history) ? cached.history : [];
      const cachedOpen = Array.isArray(cached.open_positions) ? cached.open_positions : [];

      const liveIds = new Set(
        mergedHistory
          .map((h: any) => h.position_id ?? h.ticket ?? h.deal_id)
          .filter((v: any) => v != null)
          .map((v: any) => String(v))
      );
      const liveOpenIds = new Set(
        mergedOpen
          .map((p: any) => p.position_id ?? p.ticket ?? p.deal_id)
          .filter((v: any) => v != null)
          .map((v: any) => String(v))
      );

      for (const h of cachedHistory) {
        const id = h.position_id ?? h.ticket ?? h.deal_id;
        if (id != null && !liveIds.has(String(id))) {
          mergedHistory.push(h);
        }
      }
      for (const p of cachedOpen) {
        const id = p.position_id ?? p.ticket ?? p.deal_id;
        if (id != null && !liveOpenIds.has(String(id))) {
          mergedOpen.push(p);
        }
      }
    } catch (mergeErr) {
      console.warn('[MasterHistory] Failed to merge cached trades with live data (non-fatal):', mergeErr);
    }

    const finalHistory = [...mergedHistory].sort((a, b) => {
      const getTime = (t: any) => {
        if (t == null) return 0;
        if (typeof t === 'number') return t < 1e12 ? t * 1000 : t;
        try {
          return new Date(t).getTime();
        } catch {
          return 0;
        }
      };
      return getTime(b.time_close ?? b.time_open) - getTime(a.time_close ?? a.time_open);
    });

    // Always ensure open positions list is in sync with any merged/cached data.
    const finalOpenPositions = mergedOpen;

    let errorStr: string | undefined;
    if (data.error && String(data.error).trim()) errorStr = data.error;
    else if (finalHistory.length === 0 && finalOpenPositions.length === 0)
      errorStr = 'No trading data from MT5. Master account may have no positions or history.';

    // Write-through cache for stale-while-revalidate behavior.
    // If this fails, we still return live data.
    try {
      if (finalHistory.length > 0) {
        await upsertMasterTrades(masterId, finalHistory, false);
      }
      // Reconcile open positions so closed trades don't remain stuck as "open" in cached views.
      await reconcileMasterOpenPositions(masterId, finalOpenPositions);
    } catch (e) {
      console.warn('[MasterHistory] Cache write failed (non-fatal):', e);
    }

    return NextResponse.json({
      history: finalHistory,
      open_positions: finalOpenPositions,
      error: errorStr,
      last_updated: new Date().toISOString(),
      info: 'Live data from MT5 terminal (real-time)',
    });
  } catch (e: any) {
    const isAbort = e?.name === 'AbortError';
    console.warn(
      `[MasterHistory] Live fetch error for master ${masterId}: ${isAbort ? 'timeout' : e?.message || e}`
    );
    return fallbackFromCache();
  }
}
