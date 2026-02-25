import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { readDatabase } from '@/db/dbService';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const db = readDatabase();
    const snaps = Array.isArray((db as any).disconnect_snapshots) ? (db as any).disconnect_snapshots : [];
    const items = snaps
      .filter((s: any) => s && s.running_strategy_id === params.id)
      .sort((a: any, b: any) => {
        const ta = Date.parse(a.snapshot_at || '') || 0;
        const tb = Date.parse(b.snapshot_at || '') || 0;
        return tb - ta;
      });
    const latest = items[0] || null;
    return NextResponse.json({ snapshot: latest });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load snapshot' }, { status: 500 });
  }
}
