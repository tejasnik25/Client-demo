import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getRunningStrategyById } from '@/db/dbService';
import pool from '@/db/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rsId } = await params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rs = await getRunningStrategyById(rsId);
    if (!rs) {
      return NextResponse.json({ error: 'Running strategy not found' }, { status: 404 });
    }

    const [settlements]: any = await pool.execute(`
      SELECT psi.*, ps.settlement_start, ps.settlement_end, ps.created_at as settlement_created_at
      FROM profit_settlement_items psi
      JOIN profit_settlements ps ON psi.settlement_id = ps.id
      WHERE psi.user_id = ? 
        AND psi.strategy_id = ?
        AND ps.created_at >= ?
      ORDER BY ps.settlement_end DESC, ps.created_at DESC
    `, [rs.userId, rs.strategyId, rs.created_at]);

    let settlementRows: any[] = settlements;
    if (!Array.isArray(settlementRows) || settlementRows.length === 0) {
      console.warn(`[SettlementsAPI] No settlements found for rsId=${rsId} using created_at filter; falling back to full user strategy settlement history.`);
      const [fallbackSettlements]: any = await pool.execute(`
        SELECT psi.*, ps.settlement_start, ps.settlement_end, ps.created_at as settlement_created_at
        FROM profit_settlement_items psi
        JOIN profit_settlements ps ON psi.settlement_id = ps.id
        WHERE psi.user_id = ? 
          AND psi.strategy_id = ?
        ORDER BY ps.settlement_end DESC, ps.created_at DESC
      `, [rs.userId, rs.strategyId]);
      settlementRows = fallbackSettlements;
    }

    const mapped = settlementRows.map((s: any) => ({
      ...s,
      settlementStart: s.settlement_start ? s.settlement_start.toISOString() : null,
      settlementEnd: s.settlement_end ? s.settlement_end.toISOString() : null,
      createdAt: s.created_at ? s.created_at.toISOString() : null
    }));

    console.log(`[SettlementsAPI] Running strategy ${rsId} created at ${rs.created_at}, found ${mapped.length} settlements`);
    
    return NextResponse.json({ settlements: mapped });
  } catch (error: any) {
    console.error('Error fetching user settlements:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch settlements' }, { status: 500 });
  }
}
