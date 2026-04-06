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
  getStrategyById,
  runProfitSharingSettlementAdmin,
  createWalletTransaction,
  deleteRunningStrategy,
  clearStrategyCache
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

  // Enforce stop and close when disconnecting + run settlement + update wallet
  if (finalStatus === 'disconnected') {
    try {
      const openPositions = await mt5Service.getOpenPositions(params.id);
      if (Array.isArray(openPositions?.positions) && openPositions.positions.length > 0) {
        await mt5Service.closeAllPositions(params.id);
      }
    } catch (err) {
      console.error('Failed to close open positions during disconnect:', err);
    }

    try {
      await mt5Service.stopCopyTrading(params.id);
    } catch (err) {
      console.error('Failed to stop copy trading during disconnect:', err);
    }

    try {
      const running = await getRunningStrategyById(params.id);
      if (running?.strategyId) {
        const settlementResult = await runProfitSharingSettlementAdmin(running.strategyId, (session.user as any).id);
        if (settlementResult?.success && Array.isArray(settlementResult.items)) {
          // runProfitSharingSettlementAdmin already creates deposit transactions for settled strategy funds.
          // Avoid duplicating deposits here to keep balance correct.
          console.log(`[StatusUpdate] Strategy ${running.strategyId} profit settlement completed for ${settlementResult.items.length} users`);
        }
      }
    } catch (err) {
      console.error('Settlement/central wallet update failed on disconnect:', err);
    }

    // DELETE the running strategy completely after settlement
    try {
      console.log(`[StrategyCleanup] Deleting running strategy ${params.id} after disconnect`);
      const deleteResult = await deleteRunningStrategy(params.id);
      if (deleteResult) {
        console.log(`[StrategyCleanup] Successfully deleted running strategy ${params.id}`);
        
        // Clear cached data for this strategy
        await clearStrategyCache(params.id);
        console.log(`[StrategyCleanup] Cache cleanup initiated for strategy ${params.id}`);
      } else {
        console.error(`[StrategyCleanup] Failed to delete running strategy ${params.id}`);
      }
    } catch (err) {
      console.error('Strategy deletion failed on disconnect:', err);
    }
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
