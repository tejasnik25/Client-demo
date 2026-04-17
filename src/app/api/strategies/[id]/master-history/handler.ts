import { NextRequest, NextResponse } from 'next/server';
import { 
  getStrategyById, 
  getCachedMasterTrades, 
  upsertMasterTrades, 
  reconcileMasterOpenPositions, 
  getTradeLotRecords,
  getUnifiedLotTimeline,
  getLotForTime,
  getLatestLotSizeForUserStrategy,
  saveTradeLotRecord
} from '@/db/dbService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 25;

const PYTHON_SERVICE_TIMEOUT_MS = 20000;
const DEFAULT_COPY_TRADING_API_KEY = '9f236bab9fe640848a142f7d17a1960c8582d3ac18a96cc7ec86bb23c10ad6ad';

function toEpochMs(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null;
    return v < 1e12 ? Math.floor(v * 1000) : Math.floor(v);
  }
  const s = String(v).trim();
  if (!s) return null;

  // If it looks like a number string.
  const asNum = Number(s);
  if (Number.isFinite(asNum)) return toEpochMs(asNum);

  // ISO / RFC.
  const t = new Date(s).getTime();
  if (Number.isFinite(t)) return t;

  // MT5-like: "13 Apr 17:58:47" or "13 Apr 17:58:47 UTC"
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2}):(\d{2}):(\d{2})(?:\s*(UTC))?$/);
  if (m) {
    const day = Number(m[1]);
    const monStr = m[2].toLowerCase();
    const hh = Number(m[3]);
    const mm = Number(m[4]);
    const ss = Number(m[5]);
    const months: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    const mon = months[monStr];
    if (mon != null && Number.isFinite(day) && Number.isFinite(hh) && Number.isFinite(mm) && Number.isFinite(ss)) {
      const year = new Date().getUTCFullYear();
      return Date.UTC(year, mon, day, hh, mm, ss);
    }
  }

  return null;
}

function getTradingServiceBaseUrls(): string[] {
  const envUrl =
    process.env.COPY_TRADING_API_URL ||
    process.env.COPY_TRADING_URL ||
    process.env.NEXT_PUBLIC_COPY_TRADING_API_URL ||
    process.env.NEXT_PUBLIC_COPY_TRADING_URL;

  if (envUrl && !envUrl.includes('mock')) {
    const final = envUrl.replace(/\/$/, '');
    console.log(`[MasterHistory] Using configured provider URL: ${final}`);
    return [final];
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('[MasterHistory] COPY_TRADING_API_URL/COPY_TRADING_URL missing in production; defaulting to AWS IP 15.206.157.59:8000');
    return ['http://15.206.157.59:8000'];
  }

  console.warn('[MasterHistory] COPY_TRADING_API_URL/COPY_TRADING_URL missing in development; trying localhost then AWS fallback');
  return ['http://127.0.0.1:8000', 'http://15.206.157.59:8000'];
}

function getTradingServiceBaseUrl(): string {
  const urls = getTradingServiceBaseUrls();
  return urls[0];
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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const strategy = await getStrategyById(id);

  if (!strategy) {
    return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
  }

  // Fetch persisted lot records for this user if available
  const tradeLots = userId ? await getTradeLotRecords(userId, id) : {};

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
    time_open_ms: toEpochMs(trade.time_open || trade.server_time_open || trade.time || null),
    time_close_ms: toEpochMs(trade.time_close || trade.server_time_close || null),
  });

  const autoCaptureLots = async (trades: any[], existingLots: Record<string, number>) => {
    if (!userId) return existingLots;
    try {
      const timeline = await getUnifiedLotTimeline(userId, id);
      const currentMultiplier = await getLatestLotSizeForUserStrategy(userId, id);
      let needsRefresh = false;
      const updatedLots = { ...existingLots };

      for (const t of trades) {
        const ticket = String(t.position_id ?? t.ticket ?? t.id ?? '');
        if (ticket && !updatedLots[ticket]) {
          const openMs = toEpochMs(t.time_open ?? t.server_time_open ?? t.time_open_ms ?? t.time ?? null);
          const multiplier = openMs 
            ? getLotForTime(openMs, timeline, currentMultiplier) 
            : currentMultiplier;
          
          if (multiplier > 0) {
            await saveTradeLotRecord(ticket, userId, id, multiplier);
            updatedLots[ticket] = multiplier;
            needsRefresh = true;
          }
        }
      }
      return needsRefresh ? await getTradeLotRecords(userId, id) : updatedLots;
    } catch (e) {
      console.warn('[MasterHistory] autoCaptureLots failed:', e);
      return existingLots;
    }
  };

  const fallbackFromCache = async (reason?: string) => {
    try {
      const cached = await getCachedMasterTrades(masterId);
      const hist = Array.isArray(cached.history) ? cached.history.map(normalizeCachedTrade) : [];
      const open = Array.isArray(cached.open_positions) ? cached.open_positions.map(normalizeCachedTrade) : [];
      
      const finalLots = await autoCaptureLots([...open, ...hist], tradeLots);

      if (hist.length === 0 && open.length === 0) {
        return NextResponse.json({
          history: [],
          open_positions: [],
          trade_lots: finalLots,
          error: reason || 'No trading data available yet.',
          last_updated: cached.last_updated,
          info: 'No cached data available',
        });
      }
      return NextResponse.json({
        history: hist,
        open_positions: open,
        trade_lots: finalLots,
        cached: true,
        error: undefined,
        last_updated: cached.last_updated,
        info: 'Served cached data (live fetch failed)',
      });
    } catch {
      return NextResponse.json({
        history: [],
        open_positions: [],
        trade_lots: tradeLots,
        error: reason || 'Failed to load trading data.',
        last_updated: new Date().toISOString(),
        info: 'Cache and live fetch failed',
      });
    }
  };

  const apiKey = (process.env.COPY_TRADING_API_KEY || DEFAULT_COPY_TRADING_API_KEY).trim();
  if (!process.env.COPY_TRADING_API_KEY) {
    console.warn('[MasterHistory] COPY_TRADING_API_KEY missing/empty; using default fallback key and attempting live fetch');
  }

  const cached = await getCachedMasterTrades(masterId);
  const cachedHist = Array.isArray(cached.history) ? cached.history.map(normalizeCachedTrade) : [];
  const cachedOpen = Array.isArray(cached.open_positions) ? cached.open_positions.map(normalizeCachedTrade) : [];

  const candidateUrls = getTradingServiceBaseUrls();
  let liveResponse: Response | null = null;
  let liveErrorMessage = '';

  for (const baseUrl of candidateUrls) {
    const liveUrl = `${baseUrl}/master/${encodeURIComponent(masterId)}/history`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PYTHON_SERVICE_TIMEOUT_MS);

    try {
      const r = await fetch(liveUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!r.ok) {
        const text = await r.text().catch(() => r.statusText);
        console.warn(`[MasterHistory] Live fetch failed ${r.status} for master ${masterId} at ${liveUrl}: ${text}`);
        liveErrorMessage = `HTTP ${r.status}: ${text}`;
        continue;
      }

      liveResponse = r;
      console.log(`[MasterHistory] Live fetch succeeded for master ${masterId} at ${liveUrl}`);
      break;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const message = (fetchError as any)?.message || fetchError;
      console.warn(`[MasterHistory] Live fetch error for master ${masterId} at ${liveUrl}: ${message}`);
      liveErrorMessage = String(message);
    }
  }

  if (!liveResponse) {
    if (cachedHist.length > 0 || cachedOpen.length > 0) {
      const finalLots = await autoCaptureLots([...cachedOpen, ...cachedHist], tradeLots);
      return NextResponse.json({
        history: cachedHist,
        open_positions: cachedOpen,
        trade_lots: finalLots,
        cached: true,
        error: liveErrorMessage || 'Live fetch failed; serving cached data.',
        last_updated: cached.last_updated,
        info: 'Serving cached data while live fetch is unavailable',
      });
    }

    return fallbackFromCache(liveErrorMessage || 'Live fetch failed.');
  }


  const data = (await liveResponse.json()) as {
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
        time_open_ms: toEpochMs(p.time_open ?? p.server_time_open ?? p.server_time ?? p.time ?? null),
        time_close_ms: toEpochMs(p.time_close ?? p.server_time_close ?? null),
      })
    );

    // Merge with cached DB history to avoid missing trades if either
    // the live MT5 endpoint or the push-based sync lags behind.
    let mergedHistory = [...history];
    let mergedOpen = [...open_positions];
    try {
      const cached = await getCachedMasterTrades(masterId);
      const cachedHistory = Array.isArray(cached.history) ? cached.history : [];
      // CRITICAL: We DO NOT merge cached open positions if we have a successful live fetch.
      // The live fetch is the source of truth for currently open positions.
      // If a position was in the cache but is not in the live fetch, it means it has been closed.

      const liveIds = new Set(
        mergedHistory
          .map((h: any) => h.position_id ?? h.ticket ?? h.deal_id)
          .filter((v: any) => v != null)
          .map((v: any) => String(v))
      );

      for (const h of cachedHistory) {
        const id = h.position_id ?? h.ticket ?? h.deal_id;
        if (id != null && !liveIds.has(String(id))) {
          mergedHistory.push(h);
        }
      }
    } catch (mergeErr) {
      console.warn('[MasterHistory] Failed to merge cached trades with live data (non-fatal):', mergeErr);
    }

    const finalHistory = [...mergedHistory]
      .map((t: any) => ({
        ...t,
        time_open_ms: toEpochMs(t.time_open ?? t.server_time_open ?? t.server_time ?? t.time ?? null),
        time_close_ms: toEpochMs(t.time_close ?? t.server_time_close ?? null),
      }))
      .sort((a, b) => {
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

    // --- Backend Lot Locking & Auto-Capture ---
    const finalTradeLots = await autoCaptureLots([...finalOpenPositions, ...finalHistory], tradeLots);

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
      trade_lots: finalTradeLots,
      cached: false,
      error: errorStr,
      last_updated: new Date().toISOString(),
      info: 'Live data from MT5 terminal (real-time)',
    });
}

