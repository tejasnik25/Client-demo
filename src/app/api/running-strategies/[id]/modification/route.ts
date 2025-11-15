import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { createRunningStrategyModification, updateRunningStrategyAdminStatus } from '@/db/dbService';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'USER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as any)?.id;
  const body = await req.json().catch(() => ({}));
  const payload = {
    id: uuidv4(),
    running_strategy_id: params.id,
    user_id: userId,
    platform: (body.platform ?? null) as 'MT4' | 'MT5' | null,
    mt_account_id: body.mt_account_id ?? null,
    mt_account_password: body.mt_account_password ?? null,
    mt_account_server: body.mt_account_server ?? null,
    status: 'in-process' as const,
    new_update_json: body,
  };
  const res = await createRunningStrategyModification(payload);
  if (!res.success) {
    return NextResponse.json({ error: 'Failed to create modification' }, { status: 500 });
  }
  await updateRunningStrategyAdminStatus(params.id, 'in-process');
  return NextResponse.json({ success: true });
}