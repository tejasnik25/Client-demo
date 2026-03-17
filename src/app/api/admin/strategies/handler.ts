import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getAllStrategies, updateStrategy } from '@/db/dbService';

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const strategies = await getAllStrategies();
    // Never return master passwords to the browser; expose only safe metadata.
    const sanitized = (strategies || []).map((s: any) => ({
      ...s,
      masterAccountPassword: undefined,
      master_account_password: undefined,
      hasMasterPassword: !!(s.masterAccountPassword || s.master_account_password),
    }));
    return NextResponse.json({ strategies: sanitized });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to fetch strategies' }, { status: 500 });
  }
}

// Admin-only: update master account details (id/server/platform/password) for a strategy.
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const { id, masterAccountId, masterAccountPassword, masterAccountServer, masterPlatform } = body || {};
    if (!id) return NextResponse.json({ error: 'Missing strategy id' }, { status: 400 });

    const res = await updateStrategy(String(id), {
      masterAccountId: masterAccountId !== undefined ? String(masterAccountId) : undefined,
      masterAccountPassword: masterAccountPassword !== undefined ? String(masterAccountPassword) : undefined,
      masterAccountServer: masterAccountServer !== undefined ? String(masterAccountServer) : undefined,
      masterPlatform: masterPlatform !== undefined ? masterPlatform : undefined,
    } as any);

    if (!res.success) {
      return NextResponse.json({ error: res.error || 'Update failed' }, { status: 400 });
    }

    // Return safe view (never include password)
    const s: any = res.strategy;
    return NextResponse.json({
      success: true,
      strategy: {
        ...s,
        masterAccountPassword: undefined,
        master_account_password: undefined,
        hasMasterPassword: !!(s?.masterAccountPassword || s?.master_account_password),
      },
    });
  } catch (e) {
    console.error('[Admin][Strategies] PATCH failed:', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
