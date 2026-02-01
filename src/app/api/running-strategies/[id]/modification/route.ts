import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { 
  createRunningStrategyModification, 
  updateRunningStrategyAdminStatus,
  getRunningStrategyById,
  getStrategyById
} from '@/db/dbService';
import { mt5Service, MtAccountDetails } from '@/lib/mt5-service';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'USER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as any)?.id;
  const body = await req.json().catch(() => ({}));

  // 1. Fetch Running Strategy
  const runningStrategy = await getRunningStrategyById(params.id);
  if (!runningStrategy) {
    return NextResponse.json({ error: 'Running strategy not found' }, { status: 404 });
  }

  // 2. Fetch Strategy (for Master details)
  const strategy = await getStrategyById(runningStrategy.strategyId);

  // 3. Validate Connection / Prepare Details
  const slaveDetails: MtAccountDetails = {
    id: (body.mt_account_id || runningStrategy.mtAccountId || '').toString().trim(), 
    password: (body.mt_account_password || runningStrategy.mtAccountPassword || '').toString().trim(),
    server: (body.mt_account_server || runningStrategy.mtAccountServer || '').toString().trim(),
    platform: (body.platform as 'MT4'|'MT5') || (runningStrategy.platform as 'MT4'|'MT5') || 'MT5'
  };

  // Only validate if details are provided (assuming update contains details)
  // If user is just changing status (disconnect/enable), body.action might be present
  if (body.action === 'disconnect') {
    // STOP Copy Trading
    try {
        await mt5Service.stopCopyTrading(params.id);
    } catch (e) {
        console.error('Failed to stop copy trading:', e);
    }

    await updateRunningStrategyAdminStatus(params.id, 'disconnected');
    // Also create a modification record for history
    const modPayload: any = {
        id: uuidv4(),
        running_strategy_id: params.id,
        user_id: userId,
        platform: slaveDetails.platform,
        mt_account_id: slaveDetails.id,
        mt_account_password: slaveDetails.password,
        mt_account_server: slaveDetails.server,
        status: 'disconnected',
        new_update_json: body,
    };
    await createRunningStrategyModification(modPayload);
    return NextResponse.json({ success: true });
  }
  
  if (body.action === 'enable') {
     // Validate Connection First
     const validation = await mt5Service.validateConnection(slaveDetails);
     let finalStatus: 'running' | 'wrong-account-password' | 'wrong-account-id' | 'wrong-account-server-name' = 'running';

     if (!validation.success) {
        if (validation.error === 'Wrong-Password') finalStatus = 'wrong-account-password';
        else if (validation.error === 'Wrong-Id') finalStatus = 'wrong-account-id';
        else if (validation.error === 'Wrong-Server') finalStatus = 'wrong-account-server-name';
        else finalStatus = 'wrong-account-id'; 
     }

     await updateRunningStrategyAdminStatus(params.id, finalStatus);

     // If valid, START Copy Trading
     if (finalStatus === 'running' && strategy && strategy.masterAccountId) {
        const masterDetails: MtAccountDetails = {
            id: strategy.masterAccountId,
            password: strategy.masterAccountPassword || '',
            server: strategy.masterAccountServer || '',
            platform: strategy.masterPlatform || 'MT5'
        };
        try {
            await mt5Service.startCopyTrading(masterDetails, slaveDetails, params.id);
        } catch (e: any) {
            console.error('Failed to start copy trading on enable:', e);
            // REVERT STATUS on failure
            await updateRunningStrategyAdminStatus(params.id, 'Connection Failed');
            return NextResponse.json({ success: false, status: 'Connection Failed', error: e.message || 'Failed to start copy trading' });
        }
     }

     return NextResponse.json({ success: true, status: finalStatus });
  }

  // Regular update (User changing details)
  // 1. Always STOP existing copy trading first to ensure clean state
  try {
      await mt5Service.stopCopyTrading(params.id);
  } catch (e) {
      console.error('Failed to stop copy trading during update:', e);
  }

  const validation = await mt5Service.validateConnection(slaveDetails);

  let finalStatus: string = 'running';

  if (!validation.success) {
     if (validation.error === 'Wrong-Password') finalStatus = 'wrong-account-password';
     else if (validation.error === 'Wrong-Id') finalStatus = 'wrong-account-id';
     else if (validation.error === 'Wrong-Server') finalStatus = 'wrong-account-server-name';
     else if (validation.error === 'Service-Error') finalStatus = 'Service Error';
     // Ensure any other error (like Connection Failed) is NOT mapped to 'running'
     else finalStatus = validation.error || 'Connection Failed'; 
  }

  const payload = {
    id: uuidv4(),
    running_strategy_id: params.id,
    user_id: userId,
    platform: slaveDetails.platform,
    mt_account_id: slaveDetails.id,
    mt_account_password: slaveDetails.password,
    mt_account_server: slaveDetails.server,
    status: finalStatus,
    new_update_json: body,
  };

  const res = await createRunningStrategyModification(payload);
  if (!res.success) {
    return NextResponse.json({ error: 'Failed to create modification' }, { status: 500 });
  }

  // Update status in running_strategies table
  await updateRunningStrategyAdminStatus(params.id, finalStatus);

  // If valid, start copy trading
  if (finalStatus === 'running' && strategy && strategy.masterAccountId) {
      const masterDetails: MtAccountDetails = {
        id: strategy.masterAccountId,
        password: strategy.masterAccountPassword || '',
        server: strategy.masterAccountServer || '',
        platform: strategy.masterPlatform || 'MT5'
      };
      try {
        await mt5Service.startCopyTrading(masterDetails, slaveDetails, params.id);
      } catch (e: any) {
        console.error('Failed to start copy trading on update:', e);
        // REVERT STATUS on failure
        await updateRunningStrategyAdminStatus(params.id, 'Connection Failed');
        return NextResponse.json({ success: false, status: 'Connection Failed', error: e.message || 'Failed to start copy trading' });
      }
  }

  return NextResponse.json({ success: true, status: finalStatus });
}