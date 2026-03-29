import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { 
  updateRunningStrategyAdminStatus, 
  getRunningStrategyModificationById, 
  updateRunningStrategyMtDetails, 
  getPendingModificationsForStrategy, 
  startRunningPeriod, 
  endRunningPeriod, 
  approveRunningStrategyModification, 
  getRunningStrategyById, 
  getStrategyById 
} from '@/db/dbService'
import { mt5Service } from '@/lib/mt5-service'

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
  if (status && (status.toLowerCase() === 'stopped' || status.toLowerCase() === 'disconnect')) {
    status = 'disconnected'
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
      
      // Mark modification as approved
      await approveRunningStrategyModification(modId, session.user.id)
    }
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
       // Mark modification as approved
       await approveRunningStrategyModification(mod.id, session.user.id)
    }
  }
  // We directly use the status provided by the admin. 
  // Previously we would set it back to 'in-process' if modifications were pending,
  // but that created a bug where status could never be finalized.
  const finalStatus = status;
  console.log(`[StatusUpdate] Updating strategy ${params.id} to status: ${finalStatus}`);
  
  const result = await updateRunningStrategyAdminStatus(params.id, finalStatus as any)
  if (!result) {
    console.error(`[StatusUpdate] Failed to update strategy ${params.id} in DB`);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
  console.log(`[StatusUpdate] Successfully updated strategy ${params.id} to status: ${finalStatus}`);

  // Handle periods
  if (finalStatus === 'running') {
    await startRunningPeriod(params.id)
  } else if (finalStatus === 'disconnected') {
    await endRunningPeriod(params.id)
  }

  // Enforce stop and close when disconnecting
  if (finalStatus === 'disconnected') {
    try { await mt5Service.stopCopyTrading(params.id) } catch {}
    try { await mt5Service.closeAllPositions(params.id) } catch {}
  }
  // Auto-start copy trading when moving to running (if credentials exist)
  if (finalStatus === 'running') {
    try {
      const running = await getRunningStrategyById(params.id);
      if (running) {
        const strategy = await getStrategyById(running.strategyId);
        const masterId = (strategy as any)?.masterAccountId;
        const masterPwd = (strategy as any)?.masterAccountPassword || '';
        const masterSrv = (strategy as any)?.masterAccountServer || '';
        const masterPlat = ((strategy as any)?.masterPlatform || 'MT5').toUpperCase() as 'MT4' | 'MT5';
        const slaveId = running.mtAccountId || '';
        const slavePwd = running.mtAccountPassword || '';
        const slaveSrv = running.mtAccountServer || '';
        const slavePlat = ((running.platform as any) || 'MT5').toUpperCase() as 'MT4' | 'MT5';
        if (masterId && slaveId && slavePwd) {
          await mt5Service.startCopyTrading(
            { id: masterId, password: masterPwd, server: masterSrv, platform: masterPlat },
            { id: slaveId, password: slavePwd, server: slaveSrv, platform: slavePlat },
            params.id
          );
        }
      }
    } catch (e) {
      // do not fail the status update if auto-start fails
    }
  }

  return NextResponse.json({ success: true })
}
