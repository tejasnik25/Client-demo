import { NextRequest, NextResponse } from 'next/server';
import { upsertMasterTrades } from '@/db/dbService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const apiKey = process.env.COPY_TRADING_API_KEY;
    if (!apiKey) {
      console.error('[Sync] COPY_TRADING_API_KEY missing');
      return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 });
    }
    
    if (authHeader !== `Bearer ${apiKey}`) {
      console.warn('[Sync] Unauthorized push attempt');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { master_id, history, open_positions } = body;

    if (!master_id) {
      return NextResponse.json({ success: false, error: 'Missing master_id' }, { status: 400 });
    }

      console.log('[Sync] Incoming history sample:', JSON.stringify(history[0], null, 2));
      const mappedHistory = history.map(t => ({
        position_id: String(t.position_id),
        symbol: t.symbol,
        type: t.type === 0 || t.type === '0' || String(t.type).toLowerCase().includes('buy') ? 'BUY' : 'SELL',
        volume: Number(t.volume),
        price_open: Number(t.price_open),
        price_close: Number(t.price_close),
        profit: Number(t.profit),
        commission: Number(t.commission || 0),
        swap: Number(t.swap || 0),
        time_open: typeof t.time_open === 'number' ? new Date(t.time_open * 1000).toISOString() : (t.time_open || t.open_time),
        time_close: typeof t.time_close === 'number' ? new Date(t.time_close * 1000).toISOString() : (t.time_close || t.close_time),
        server_time_open: t.server_time_open || t.open_time_str || t.server_time_open_str || null,
        server_time_close: t.server_time_close || t.close_time_str || t.server_time_close_str || null,
      }));
      console.log('[Sync] Mapped history sample:', JSON.stringify(mappedHistory[0], null, 2));
          server_time_open: serverOpen,
          server_time_close: serverClose,
        };
      });
      await upsertMasterTrades(master_id, mappedHistory, false);
      console.log('[Sync] Incoming open_positions sample:', JSON.stringify(open_positions[0], null, 2));
      const mappedOpen = open_positions.map(t => ({
        position_id: String(t.ticket || t.position_id),
        symbol: t.symbol,
        type: t.type_str || (t.type === 0 || t.type === '0' || String(t.type).toLowerCase().includes('buy') ? 'BUY' : 'SELL'),
        volume: Number(t.volume),
        price_open: Number(t.price_open),
        price_current: Number(t.price_current), // Ensure price_current is passed for open trades
        profit: Number(t.profit),
        commission: Number(t.commission || 0),
        swap: Number(t.swap || 0),
        time_open: typeof t.time === 'number' ? new Date(t.time * 1000).toISOString() : (t.time_open || t.time || t.open_time),
        server_time_open: t.server_time || t.server_time_open || null,
        time_close: null // Explicitly null for open positions
      }));
      console.log('[Sync] Mapped open_positions sample:', JSON.stringify(mappedOpen[0], null, 2));
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
