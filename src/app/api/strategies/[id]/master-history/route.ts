import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById } from '@/db/dbService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const pathsClosed = [
      `/master/${masterId}/history`,
      `/masters/${masterId}/history`,
      `/master/${masterId}/positions/closed`,
      `/master/history?id=${masterId}`
    ];
    const pathsOpen = [
      `/master/${masterId}/open`,
      `/masters/${masterId}/open`,
      `/master/${masterId}/positions/open`,
      `/master/${masterId}/positions`
    ];

    let history: any[] = [];
    let open_positions: any[] = [];
    const errors: string[] = [];

    for (const p of pathsClosed) {
      try {
        const res = await fetch(`${apiUrl}${p}`, { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' });
        if (!res.ok) {
          try {
            const ej = await res.json().catch(() => null);
            if (ej?.detail) errors.push(`${p}: ${ej.detail}`);
            else errors.push(`${p}: ${res.status} ${res.statusText}`);
          } catch {
            errors.push(`${p}: ${res.status} ${res.statusText}`);
          }
          continue;
        }
        const json = await res.json().catch(() => null);
        if (Array.isArray(json)) {
          history = json.map(mapClosed);
        } else if (json && typeof json === 'object') {
          const rawClosed = json.history ?? json.closed_positions ?? json.closed ?? json.positions ?? [];
          if (Array.isArray(rawClosed)) {
            history = rawClosed.map(mapClosed);
          }
          const rawOpenInline = json.open_positions ?? json.open ?? [];
          if (Array.isArray(rawOpenInline)) {
            open_positions = rawOpenInline.map(mapOpen);
          }
        }
        if (history.length > 0 || open_positions.length > 0) break;
      } catch (e: any) {
        errors.push(`${p}: ${e?.message || 'request failed'}`);
      }
    }

    if (open_positions.length === 0) {
      for (const p of pathsOpen) {
        try {
          const res = await fetch(`${apiUrl}${p}`, { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' });
          if (!res.ok) {
            try {
              const ej = await res.json().catch(() => null);
              if (ej?.detail) errors.push(`${p}: ${ej.detail}`);
              else errors.push(`${p}: ${res.status} ${res.statusText}`);
            } catch {
              errors.push(`${p}: ${res.status} ${res.statusText}`);
            }
            continue;
          }
          const json = await res.json().catch(() => null);
          const rawOpen = Array.isArray(json) ? json : (json?.open_positions ?? json?.open ?? json?.positions ?? []);
          if (Array.isArray(rawOpen)) {
            open_positions = rawOpen.map(mapOpen);
            if (open_positions.length > 0) break;
          }
        } catch (e: any) {
          errors.push(`${p}: ${e?.message || 'request failed'}`);
        }
      }
    }

    return NextResponse.json({ history, open_positions, error: errors.length ? errors.join(' | ') : undefined });
  } catch (error: any) {
    console.error('Error fetching master history:', error);
    return NextResponse.json({ history: [], open_positions: [], error: 'Connection to trading service failed' });
  }
}
