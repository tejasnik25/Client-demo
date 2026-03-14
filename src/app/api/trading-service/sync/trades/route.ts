import { NextRequest, NextResponse } from 'next/server';
import { upsertMasterTrades } from '@/db/dbService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const apiKey = process.env.COPY_TRADING_API_KEY || '9f236bab9fe640848a142f7d17a1960c8582d3ac18a96cc7ec86bb23c10ad6ad';
    
    if (authHeader !== `Bearer ${apiKey}`) {
      console.warn('[Sync] Unauthorized push attempt');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { master_id, history, open_positions } = body;

    if (!master_id) {
      return NextResponse.json({ success: false, error: 'Missing master_id' }, { status: 400 });
    }

    console.log(`[Sync] Received push for master ${master_id}: ${history?.length || 0} history, ${open_positions?.length || 0} open`);

    // 1. Process History (Closed Trades)
    if (history && Array.isArray(history)) {
      console.log(`[Sync] Mapping ${history.length} history items`);
      const mappedHistory = history.map(t => {
        const timeOpenNum = typeof t.time_open === 'number' ? t.time_open : null;
        const timeCloseNum = typeof t.time_close === 'number' ? t.time_close : null;
        const timeOpenStr = timeOpenNum != null ? new Date(timeOpenNum * 1000).toISOString() : (t.time_open || t.open_time);
        const timeCloseStr = timeCloseNum != null ? new Date(timeCloseNum * 1000).toISOString() : (t.time_close || t.close_time);
        // Prefer broker server_time_* strings for display; keep time_open/time_close as ISO for DB
        const serverOpen = t.server_time_open && String(t.server_time_open).trim() ? String(t.server_time_open) : null;
        const serverClose = t.server_time_close && String(t.server_time_close).trim() ? String(t.server_time_close) : null;
        return {
          position_id: String(t.position_id),
          symbol: t.symbol,
          type: (t.type === 0 || t.type === '0' || String(t.type).toUpperCase() === 'BUY' || String(t.type).toLowerCase().includes('buy')) ? 'BUY' : 'SELL',
          volume: Number(t.volume),
          price_open: Number(t.price_open),
          price_close: Number(t.price_close),
          profit: Number(t.profit),
          commission: Number(t.commission || 0),
          swap: Number(t.swap || 0),
          time_open: timeOpenStr,
          time_close: timeCloseStr,
          server_time_open: serverOpen,
          server_time_close: serverClose,
        };
      });
      await upsertMasterTrades(master_id, mappedHistory, false);
    }

    // 2. Process Open Positions
    if (open_positions && Array.isArray(open_positions)) {
      console.log(`[Sync] Mapping ${open_positions.length} open positions`);
      const mappedOpen = open_positions.map(t => {
        const timeNum = typeof t.time === 'number' ? t.time : (typeof t.time_open === 'number' ? t.time_open : null);
        const timeStr = timeNum != null ? new Date(timeNum * 1000).toISOString() : (t.time_open || t.time || t.open_time);
        const serverOpen = (t.server_time || t.server_time_open) && String(t.server_time || t.server_time_open).trim()
          ? String(t.server_time || t.server_time_open) : null;
        return {
          position_id: String(t.ticket || t.position_id),
          symbol: t.symbol,
          type: (t.type === 0 || t.type === '0' || String(t.type_str).toUpperCase() === 'BUY' || String(t.type).toLowerCase().includes('buy')) ? 'BUY' : 'SELL',
          volume: Number(t.volume),
          price_open: Number(t.price_open),
          price_current: Number(t.price_current),
          profit: Number(t.profit),
          commission: Number(t.commission || 0),
          swap: Number(t.swap || 0),
          time_open: timeStr,
          server_time_open: serverOpen,
          time_close: null
        };
      });
      await upsertMasterTrades(master_id, mappedOpen, true);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Sync] Error syncing trades:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
