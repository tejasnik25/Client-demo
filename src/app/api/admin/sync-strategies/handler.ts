import { NextResponse } from 'next/server';
import { checkAdminAuth } from '@/app/api/admin/auth';
import { getRunningStrategiesAdmin, getStrategyById } from '@/db/dbService';
import { mt5Service } from '@/lib/mt5-service';
import { MtAccountDetails } from '@/lib/mt5-service';

export async function POST() {
  try {
    const session = await checkAdminAuth();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const running = await getRunningStrategiesAdmin();
    // Filter for active/running strategies that should be in the backend
    const active = running.filter(r => 
        (r.adminStatus === 'running' || r.status === 'active') && 
        r.mtAccountId // Must have slave account details
    );
    
    let synced = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const r of active) {
        try {
            const strategy = await getStrategyById(r.strategyId);
            if (!strategy || !strategy.masterAccountId) {
                console.warn(`Strategy ${r.strategyId} missing master details`);
                continue;
            }

            const master: MtAccountDetails = {
                id: strategy.masterAccountId,
                password: strategy.masterAccountPassword || '',
                server: strategy.masterAccountServer || '',
                platform: (strategy.masterPlatform as any)?.toUpperCase() === 'MT4' ? 'MT4' : 'MT5'
            };

            const slave: MtAccountDetails = {
                id: r.mtAccountId || '',
                password: r.mtAccountPassword || '',
                server: r.mtAccountServer || '',
                platform: (r.platform as any)?.toUpperCase() === 'MT4' ? 'MT4' : 'MT5'
            };

            // Call startCopyTrading which pushes to main.py
            await mt5Service.startCopyTrading(master, slave, r.id);
            synced++;
        } catch (e: any) {
            console.error(`Failed to sync ${r.id}:`, e);
            failed++;
            errors.push({ id: r.id, error: e.message });
        }
    }

    return NextResponse.json({ 
        success: true, 
        message: `Synced ${synced} strategies. Failed ${failed}.`,
        details: { synced, failed, errors }
    });
  } catch (error: any) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
