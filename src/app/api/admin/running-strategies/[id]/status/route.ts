import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { updateRunningStrategyAdminStatus, deleteRunningStrategyModification, countRunningStrategyModificationsForRun, getRunningStrategyModificationById, updateRunningStrategyMtDetails, getPendingModificationsForStrategy } from '@/db/dbService'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  let { status } = body as { status?: string }
  // Accept synonyms and map them to canonical values
  if (status && (status.toLowerCase() === 'completed' || status.toLowerCase() === 'connected')) {
    status = 'running'
  }
  const allowed = ['in-process','wrong-account-password','wrong-account-id','wrong-account-server-name','running','disconnected']
  if (!status || !allowed.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  const { modId } = body as { modId?: string }
  if (modId && (status === 'running' || status === 'disconnected')) {
    const mod = await getRunningStrategyModificationById(modId)
    if (mod) {
      const nu = typeof mod.new_update_json === 'string' ? (() => { try { return JSON.parse(mod.new_update_json as any); } catch { return {}; } })() : (mod.new_update_json || {})
      const updates: { platform?: 'MT4' | 'MT5'; mt_account_id?: string; mt_account_password?: string; mt_account_server?: string } = {}
      if (typeof (mod.platform ?? nu.platform) !== 'undefined') updates.platform = (mod.platform ?? nu.platform) || undefined
      if (typeof (mod.mt_account_id ?? nu.mt_account_id) !== 'undefined') updates.mt_account_id = (mod.mt_account_id ?? nu.mt_account_id) || undefined
      if (typeof (mod.mt_account_password ?? nu.mt_account_password) !== 'undefined') updates.mt_account_password = (mod.mt_account_password ?? nu.mt_account_password) || undefined
      if (typeof (mod.mt_account_server ?? nu.mt_account_server) !== 'undefined') updates.mt_account_server = (mod.mt_account_server ?? nu.mt_account_server) || undefined
      await updateRunningStrategyMtDetails(params.id, updates)
    }
    await deleteRunningStrategyModification(modId)
  } else if (!modId && (status === 'running' || status === 'disconnected')) {
    // Automatically process all pending modifications if status is being set to running/disconnected
    const pendingMods = await getPendingModificationsForStrategy(params.id)
    for (const mod of pendingMods) {
       const nu = typeof mod.new_update_json === 'string' ? (() => { try { return JSON.parse(mod.new_update_json as any); } catch { return {}; } })() : (mod.new_update_json || {})
       const updates: { platform?: 'MT4' | 'MT5'; mt_account_id?: string; mt_account_password?: string; mt_account_server?: string } = {}
       if (typeof (mod.platform ?? nu.platform) !== 'undefined') updates.platform = (mod.platform ?? nu.platform) || undefined
       if (typeof (mod.mt_account_id ?? nu.mt_account_id) !== 'undefined') updates.mt_account_id = (mod.mt_account_id ?? nu.mt_account_id) || undefined
       if (typeof (mod.mt_account_password ?? nu.mt_account_password) !== 'undefined') updates.mt_account_password = (mod.mt_account_password ?? nu.mt_account_password) || undefined
       if (typeof (mod.mt_account_server ?? nu.mt_account_server) !== 'undefined') updates.mt_account_server = (mod.mt_account_server ?? nu.mt_account_server) || undefined
       
       await updateRunningStrategyMtDetails(params.id, updates)
       await deleteRunningStrategyModification(mod.id)
    }
  }
  let finalStatus = status
  if (status === 'running' || status === 'disconnected') {
    const remaining = await countRunningStrategyModificationsForRun(params.id)
    if (remaining > 0) {
      finalStatus = 'in-process'
    }
  }
  const result = await updateRunningStrategyAdminStatus(params.id, finalStatus as any)
  if (!result.success) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // No auto-start of copy trading; approval only updates statuses

  return NextResponse.json({ success: true })
}
