import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById } from '@/db/dbService';

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
 * Master trade history: real-time from MT5 via Python trading service (no cache).
 * Strategy has Master linked (admin). Copier history page shows Master's open/closed trades.
 * - open_positions = Master's MT5 Trade tab (live).
 * - history = Master's MT5 History tab / closed positions (live).
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

  const apiKey =
    process.env.COPY_TRADING_API_KEY ||
    '9f236bab9fe640848a142f7d17a1960c8582d3ac18a96cc7ec86bb23c10ad6ad';
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
      return NextResponse.json({
        history: [],
        open_positions: [],
        error: `Trading service returned ${res.status}. Ensure the service is running and reachable.`,
        last_updated: new Date().toISOString(),
        info: 'Live MT5 fetch failed',
      });
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

    const finalHistory = [...history].sort((a, b) => {
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

    let errorStr: string | undefined;
    if (data.error && String(data.error).trim()) errorStr = data.error;
    else if (finalHistory.length === 0 && open_positions.length === 0)
      errorStr = 'No trading data from MT5. Master account may have no positions or history.';

    return NextResponse.json({
      history: finalHistory,
      open_positions,
      error: errorStr,
      last_updated: new Date().toISOString(),
      info: 'Live data from MT5 terminal (real-time)',
    });
  } catch (e: any) {
    const isAbort = e?.name === 'AbortError';
    console.warn(
      `[MasterHistory] Live fetch error for master ${masterId}: ${isAbort ? 'timeout' : e?.message || e}`
    );
    return NextResponse.json({
      history: [],
      open_positions: [],
      error: isAbort
        ? 'Trading service did not respond in time. Check network and service availability.'
        : 'Failed to load live data from MT5. Ensure the trading service is running.',
      last_updated: new Date().toISOString(),
      info: 'Live MT5 fetch failed',
    });
  }
}
