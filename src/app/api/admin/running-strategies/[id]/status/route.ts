import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { updateRunningStrategyAdminStatus, deleteRunningStrategyModification } from '@/db/dbService'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const { status } = body as { status?: string }
  const allowed = ['in-process','wrong-account-password','wrong-account-id','wrong-account-server-name','running','disconnected']
  if (!status || !allowed.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  const result = await updateRunningStrategyAdminStatus(params.id, status as any)
  if (!result.success) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
  // If body contains modId and status is a finalized signal, delete that specific modification
  const { modId } = body as { modId?: string }
  if (modId && (status === 'running' || status === 'disconnected')) {
    await deleteRunningStrategyModification(modId);
  }
  return NextResponse.json({ success: true })
}