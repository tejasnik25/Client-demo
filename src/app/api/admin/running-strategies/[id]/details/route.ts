import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { updateRunningStrategyMtDetails } from '@/db/dbService'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const { platform, mt_account_password, mt_account_server } = body as {
    platform?: 'MT4' | 'MT5'
    mt_account_password?: string
    mt_account_server?: string
  }
  if (!platform && !mt_account_password && !mt_account_server) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }
  const result = await updateRunningStrategyMtDetails(params.id, {
    platform,
    mt_account_password,
    mt_account_server,
  })
  if (!result.success) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}