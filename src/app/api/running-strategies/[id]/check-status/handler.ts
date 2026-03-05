import { NextResponse } from 'next/server';
import { mt5Service, MtAccountDetails } from '@/lib/mt5-service';
import { getRunningStrategyById, getStrategyById } from '@/db/dbService';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const status = await mt5Service.checkConnectionStatus(params.id);
    
    // Auto-Recovery: If subscription not found, try to restart with fresh credentials
    // Only recover if it's truly missing. Do NOT recover if it's a Login/Auth error (that needs user attention)
    const isSubscriptionMissing = 
        (status.status === 'disconnected' && (
            status.error?.includes('Subscription not found') || 
            status.detail?.includes('Subscription not found')
        )) ||
        (status.status === 'error' && (status.error?.includes('404') || status.error?.includes('Not Found') || status.error?.includes('Subscription not found')));

    if (isSubscriptionMissing) {
      try {
        const runningStrategy = await getRunningStrategyById(params.id);
        
        // If DB says it's active/running, attempt to restart
        if (runningStrategy && (runningStrategy.status === 'active' || runningStrategy.adminStatus === 'running')) {
             console.log(`[CheckStatus] Auto-Recovering missing subscription: ${params.id}`);
             const strategy = await getStrategyById(runningStrategy.strategyId);
             
             if (strategy && strategy.masterAccountId) {
                const masterDetails: MtAccountDetails = {
                    id: strategy.masterAccountId,
                    password: strategy.masterAccountPassword || '',
                    server: strategy.masterAccountServer || '',
                    platform: strategy.masterPlatform || 'MT5'
                };
                const slaveDetails: MtAccountDetails = {
                    id: runningStrategy.mtAccountId || '',
                    password: runningStrategy.mtAccountPassword || '',
                    server: runningStrategy.mtAccountServer || '',
                    platform: (runningStrategy.platform as 'MT4'|'MT5') || 'MT5'
                };
                
                await mt5Service.startCopyTrading(masterDetails, slaveDetails, params.id);
                
                // Return a temporary "reconnecting" status so frontend doesn't show error immediately
                return NextResponse.json({ 
                    status: 'active', 
                    detail: 'Recovering Connection...',
                    last_action: 'Auto-Recovery Triggered'
                });
             }
        }
      } catch (recoveryError: any) {
        console.error(`[CheckStatus] Auto-Recovery failed for ${params.id}:`, recoveryError);
        // Return the recovery error so we can debug why it failed
        return NextResponse.json({ 
            status: 'disconnected', 
            error: 'Auto-Recovery Failed',
            detail: recoveryError.message || 'Failed to restart subscription'
        });
      }
    }

    return NextResponse.json(status);
  } catch (error: any) {
    console.error(`[CheckStatus] Failed for ${params.id}:`, error);
    return NextResponse.json({ 
        status: 'error', 
        error: error.message || 'Internal Server Error',
        detail: 'Service Unreachable'
    }, { status: 500 });
  }
}
