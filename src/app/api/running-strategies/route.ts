import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getRunningStrategiesForUser, createRunningStrategy, getStrategyById, updateRunningStrategyAdminStatus, updateWalletTransactionStatus } from '@/db/dbService';
import { mt5Service, MtAccountDetails } from '@/lib/mt5-service';

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const strategies = await getRunningStrategiesForUser(session.user.id);
    return NextResponse.json(strategies);
  } catch (error) {
    console.error('Error fetching running strategies:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json();
    const { strategyId, plan, capital, platform, mtAccountId, mtAccountPassword, mtAccountServer } = body;

    if (!strategyId || !plan || !capital) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // Fetch Strategy for Master Details
    const strategy = await getStrategyById(strategyId);
    if (!strategy) {
       return new NextResponse('Strategy not found', { status: 404 });
    }

    // Prepare Slave Details
    const slaveDetails: MtAccountDetails = {
        id: (mtAccountId || '').toString().trim(),
        password: (mtAccountPassword || '').toString().trim(),
        server: (mtAccountServer || '').toString().trim(),
        platform: platform || 'MT5'
    };

    // Validate Connection
    const validation = await mt5Service.validateConnection(slaveDetails);

    const result = await createRunningStrategy(
      session.user.id,
      strategyId,
      plan,
      capital,
      {
        platform,
        mtAccountId,
        mtAccountPassword,
        mtAccountServer
      }
    );

    if (result.success && result.id) {
      let finalStatus: 'running' | 'wrong-account-password' | 'wrong-account-id' | 'wrong-account-server-name' = 'running';

      if (!validation.success) {
         if (validation.error === 'Wrong-Password') finalStatus = 'wrong-account-password';
         else if (validation.error === 'Wrong-Id') finalStatus = 'wrong-account-id';
         else if (validation.error === 'Wrong-Server') finalStatus = 'wrong-account-server-name';
         else finalStatus = 'wrong-account-id'; 
      }

      // Update status based on validation
      await updateRunningStrategyAdminStatus(result.id, finalStatus);
      
      // Update wallet transaction with rejection reason if any
      if (!validation.success) {
          await updateWalletTransactionStatus(
              (mtAccountId || '').toString().trim(), 
              'failed', 
              validation.error || 'Validation Failed'
          );
      } else {
          // If successful, mark as in-process or active? 
          // Usually 'completed' means payment done, but here we are in the context of strategy creation.
          // The wallet transaction might have been created earlier.
          // For now, we only care about setting the error reason if it failed.
      }

      // If valid, START Copy Trading
      if (finalStatus === 'running' && strategy.masterAccountId) {
         const masterDetails: MtAccountDetails = {
             id: strategy.masterAccountId,
             password: strategy.masterAccountPassword || '',
             server: strategy.masterAccountServer || '',
             platform: strategy.masterPlatform || 'MT5'
         };
         try {
             await mt5Service.startCopyTrading(masterDetails, slaveDetails, result.id);
         } catch (e) {
             console.error('Failed to start copy trading on create:', e);
         }
      }

      return NextResponse.json({ success: true, id: result.id, status: finalStatus });
    } else {
      return new NextResponse('Failed to create running strategy', { status: 500 });
    }
  } catch (error) {
    console.error('Error creating running strategy:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}