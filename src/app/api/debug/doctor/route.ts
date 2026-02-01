import { NextResponse } from 'next/server';
import { 
    getRunningStrategiesAdmin, 
    getPendingModificationsForStrategy, 
    getStrategyById, 
    updateRunningStrategyAdminStatus, 
    deleteRunningStrategyModification, 
    updateRunningStrategyMtDetails,
    getRunningStrategyModificationById,
    updateStrategy
} from '@/db/dbService';
import { mt5Service, MtAccountDetails } from '@/lib/mt5-service';

export async function GET() {
    try {
        const report = {
            total_strategies: 0,
            strategies: [] as any[],
            fixed_count: 0,
            errors: [] as string[]
        };

        const strategies = await getRunningStrategiesAdmin();
        report.total_strategies = strategies.length;

        for (const s of strategies) {
            const strategyReport: any = {
                id: s.id,
                db_status: s.status,
                admin_status: s.adminStatus,
                modifications: [],
                connection: null,
                actions_taken: []
            };

            // 1. Check Modifications
            const mods = await getPendingModificationsForStrategy(s.id);
            strategyReport.modifications = mods;

            // 2. Check Connection Status (Real-time)
            try {
                const conn = await mt5Service.checkConnectionStatus(s.id);
                strategyReport.connection = conn;
            } catch (e: any) {
                strategyReport.connection = { error: e.message };
            }

            // --- AUTO-FIX LOGIC ---

            // FIX A: Process Stuck Modifications
            if (mods.length > 0) {
                for (const mod of mods) {
                    try {
                        let updateData: any = {};
                        
                        // Parse JSON if it's a string, otherwise use as is
                        try {
                            updateData = typeof mod.new_update_json === 'string' 
                                ? JSON.parse(mod.new_update_json) 
                                : mod.new_update_json;
                        } catch (e) {
                            updateData = {}; 
                        }

                        // Handle Disconnect Request
                        if (updateData.action === 'disconnect') {
                            await mt5Service.stopCopyTrading(s.id);
                            await updateRunningStrategyAdminStatus(s.id, 'disconnected');
                            await deleteRunningStrategyModification(mod.id);
                            strategyReport.actions_taken.push(`Processed Disconnect for mod ${mod.id}`);
                        } 
                        // Handle Account Update (Normal Modification)
                        else {
                            // Update the MT details in the main record (via wallet transaction usually, but here we update the running strategy linkage)
                            await updateRunningStrategyMtDetails(s.id, {
                                platform: mod.platform || undefined,
                                mt_account_id: mod.mt_account_id || undefined,
                                mt_account_password: mod.mt_account_password || undefined,
                                mt_account_server: mod.mt_account_server || undefined
                            });

                            // After updating details, we should ensure status is running
                            await updateRunningStrategyAdminStatus(s.id, 'running');
                            await deleteRunningStrategyModification(mod.id);
                            strategyReport.actions_taken.push(`Applied Update & Deleted mod ${mod.id}`);
                            
                            // Refresh local status for next steps
                            s.adminStatus = 'running'; 
                            
                            // We need to restart copy trading with new details, which will happen in FIX C below
                        }
                    } catch (err: any) {
                        strategyReport.actions_taken.push(`Failed to process mod ${mod.id}: ${err.message}`);
                        report.errors.push(`Mod ${mod.id} error: ${err.message}`);
                    }
                }
            }

            // FIX B: If In-Process but no modifications -> Set to Running
            // Also fix if adminStatus is empty/null but db_status is something else
            const currentAdminStatus = (s.adminStatus as string) || '';
            if ((currentAdminStatus === 'in-process' || currentAdminStatus === '') && mods.length === 0) {
                // If it was supposed to be running but stuck
                await updateRunningStrategyAdminStatus(s.id, 'running');
                strategyReport.actions_taken.push('Fixed Stuck In-Process/Empty (No mods found)');
                s.adminStatus = 'running';
            }

            // FIX C: Restart Copy Trading if Missing
            const shouldBeRunning = (s.status === 'active' || s.adminStatus === 'running');
            const justProcessedMod = strategyReport.actions_taken.some((a: string) => a.includes('Applied Update'));
            
            // Handle both explicit 'disconnected' status and 'error' status which might be a 404 or Auth Failure
            const isMissing = 
                (strategyReport.connection?.status === 'disconnected' && (
                    strategyReport.connection?.detail?.includes('Subscription not found') ||
                    strategyReport.connection?.error?.includes('Subscription not found') ||
                    strategyReport.connection?.error?.includes('Master Login Failed') ||
                    strategyReport.connection?.error?.includes('Authentication failed')
                )) ||
                (strategyReport.connection?.status === 'error' && (
                    strategyReport.connection?.error?.includes('404') || 
                    strategyReport.connection?.error?.includes('Not Found') || 
                    strategyReport.connection?.error?.includes('Subscription not found')
                ));

            if (shouldBeRunning && (isMissing || justProcessedMod)) {
                 const strategy = await getStrategyById(s.strategyId);
                 
                 if (strategy && strategy.masterAccountId) {
                    const masterDetails: MtAccountDetails = {
                        id: strategy.masterAccountId,
                        password: strategy.masterAccountPassword || '',
                        server: strategy.masterAccountServer || '',
                        platform: strategy.masterPlatform || 'MT5'
                    };
                    
                    const freshStrategyList = await getRunningStrategiesAdmin();
                    const freshS = freshStrategyList.find(fs => fs.id === s.id) || s;

                    const slaveDetails: MtAccountDetails = {
                        id: freshS.mtAccountId || '',
                        password: freshS.mtAccountPassword || '',
                        server: freshS.mtAccountServer || '',
                        platform: (freshS.platform as 'MT4'|'MT5') || 'MT5'
                    };

                    if (!slaveDetails.id || !slaveDetails.password) {
                        strategyReport.actions_taken.push('Skipped Restart: Missing Slave Credentials');
                    } else {
                        try {
                            await mt5Service.startCopyTrading(masterDetails, slaveDetails, s.id);
                            strategyReport.actions_taken.push('Restarted Copy Trading Session');
                        } catch (e: any) {
                            strategyReport.actions_taken.push(`Failed to restart: ${e.message}`);
                        }
                    }
                 } else {
                     strategyReport.actions_taken.push('Skipped Restart: Master Strategy/Creds still not found');
                 }
            }

            if (strategyReport.actions_taken.length > 0) {
                report.fixed_count++;
            }
            report.strategies.push(strategyReport);
        }

        return NextResponse.json(report);
    } catch (e: any) {
        return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
    }
}
