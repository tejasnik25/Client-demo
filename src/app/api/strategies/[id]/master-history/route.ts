import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById } from '@/db/dbService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 25;

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
    const started = Date.now();
    const TOTAL_BUDGET_MS = Math.min(
      Number(process.env.MASTER_HISTORY_TOTAL_TIMEOUT_MS || 20000),
      25000
    );
    const PER_REQ_TIMEOUT_MS = Math.min(
      Number(process.env.MASTER_HISTORY_PER_REQUEST_TIMEOUT_MS || 2500),
      TOTAL_BUDGET_MS
    );
    const timeLeft = () => Math.max(0, TOTAL_BUDGET_MS - (Date.now() - started));
    const timedFetch = async (url: string, init?: RequestInit) => {
      const timeoutMs = Math.min(PER_REQ_TIMEOUT_MS, timeLeft());
      const controller = AbortSignal.timeout(timeoutMs);
      return fetch(url, { ...init, signal: controller });
    };

    const pathsClosed = [
      `/master/${masterId}/history`,
      `/masters/${masterId}/history`,
      `/master/${masterId}/positions/closed`,
      `/masters/${masterId}/positions/closed`,
      `/master/${masterId}/trades/closed`,
      `/masters/${masterId}/trades/closed`,
      `/master/${masterId}/trades`,
      `/masters/${masterId}/trades`,
      `/master/history?id=${masterId}`,
      `/masters/history?id=${masterId}`
    ];
    const pathsOpen = [
      `/master/${masterId}/open`,
      `/masters/${masterId}/open`,
      `/master/${masterId}/positions/open`,
      `/masters/${masterId}/positions/open`,
      `/master/${masterId}/positions/current`,
      `/masters/${masterId}/positions/current`,
      `/master/${masterId}/positions`
    ];

    let history: any[] = [];
    let open_positions: any[] = [];
    const errors: string[] = [];
    const non404Errors: string[] = [];

    for (const p of pathsClosed) {
      if (timeLeft() < 300) break;
      try {
        const res = await timedFetch(`${apiUrl}${p}`, { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' });
        if (!res.ok) {
          try {
            const ej = await res.json().catch(() => null);
            const msg = ej?.detail ? `${p}: ${ej.detail}` : `${p}: ${res.status} ${res.statusText}`;
            errors.push(msg);
            if (res.status !== 404) non404Errors.push(msg);
          } catch {
            const msg = `${p}: ${res.status} ${res.statusText}`;
            errors.push(msg);
            if (res.status !== 404) non404Errors.push(msg);
          }
          continue;
        }
        const json = await res.json().catch(() => null);
        if (Array.isArray(json)) {
          history = json.map(mapClosed);
        } else if (json && typeof json === 'object') {
          // Accept various shapes: direct keys, nested data/results, mixed objects
          const candidatesClosed = [
            json.history,
            json.closed_positions,
            json.closed,
            json.positions,
            json.trades,
            json.data?.history,
            json.data?.closed_positions,
            json.data?.closed,
            json.data?.positions,
            json.data?.trades,
            json.results,
          ].find((x: any) => Array.isArray(x)) || [];
          if (Array.isArray(candidatesClosed)) {
            history = candidatesClosed.map(mapClosed);
          }
          const candidatesOpen = [
            json.open_positions,
            json.open,
            json.positions,
            json.data?.open_positions,
            json.data?.open,
            json.data?.positions,
            json.results,
          ].find((x: any) => Array.isArray(x)) || [];
          if (Array.isArray(candidatesOpen)) {
            open_positions = candidatesOpen.map(mapOpen);
          }
        }
        if (history.length > 0 || open_positions.length > 0) break;
      } catch (e: any) {
        errors.push(`${p}: ${e?.message || 'request failed'}`);
      }
    }

    if (open_positions.length === 0) {
      for (const p of pathsOpen) {
        if (timeLeft() < 300) break;
        try {
          const res = await timedFetch(`${apiUrl}${p}`, { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' });
          if (!res.ok) {
            try {
              const ej = await res.json().catch(() => null);
              const msg = ej?.detail ? `${p}: ${ej.detail}` : `${p}: ${res.status} ${res.statusText}`;
              errors.push(msg);
              if (res.status !== 404) non404Errors.push(msg);
            } catch {
              const msg = `${p}: ${res.status} ${res.statusText}`;
              errors.push(msg);
              if (res.status !== 404) non404Errors.push(msg);
            }
            continue;
          }
          const json = await res.json().catch(() => null);
          const rawOpen = Array.isArray(json)
            ? json
            : (
              json?.open_positions ??
              json?.open ??
              json?.positions ??
              json?.trades ??
              json?.data?.open_positions ??
              json?.data?.open ??
              json?.data?.positions ??
              json?.data?.trades ??
              json?.results
            );
          if (Array.isArray(rawOpen)) {
            open_positions = rawOpen.map(mapOpen);
            if (open_positions.length > 0) break;
          }
        } catch (e: any) {
          errors.push(`${p}: ${e?.message || 'request failed'}`);
        }
      }
    }

    // Only surface non-404 errors so UI doesn't show long "Not Found" chains
    const errorStr = non404Errors.length ? non404Errors.join(' | ') : undefined;
    return NextResponse.json({ history, open_positions, error: errorStr });
  } catch (error: any) {
    console.error('Error fetching master history:', error);
    return NextResponse.json({ history: [], open_positions: [], error: 'Connection to trading service failed' });
  }
}
