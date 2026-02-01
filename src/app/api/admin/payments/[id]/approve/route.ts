import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '../../../auth';
import { 
  getTransactionById, 
  updateTransactionStatus,
  getStrategyById,
  createRunningStrategy,
  updateRunningStrategyAdminStatus
} from '@/db/dbService';
import { mt5Service, MtAccountDetails } from '@/lib/mt5-service';

type Params = { id: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    // Ensure admin is authenticated
    const session = await checkAdminAuth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const transactionId = params.id;

    // Fetch the transaction directly
    const transaction = await getTransactionById(transactionId);
    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Approve: mark completed and add tokens equal to amount
    const updateResult = await updateTransactionStatus(
      transactionId,
      'completed',
      session.user.id,
      Number(transaction.amount) || 0
    );

    if (!updateResult.success || !updateResult.transaction) {
      return NextResponse.json(
        { success: false, error: 'Failed to update transaction status' },
        { status: 500 }
      );
    }

    // New: Handle Strategy Connection and Validation
    if (transaction.strategy_id) {
      try {
        const strategy = await getStrategyById(transaction.strategy_id);
        
        if (strategy) {
          const slaveDetails: MtAccountDetails = {
            id: (transaction.mt_account_id || '').toString().trim(),
            password: (transaction.mt_account_password || '').toString().trim(),
            server: (transaction.mt_account_server || '').toString().trim(),
            platform: (transaction.platform as 'MT4' | 'MT5') || 'MT5'
          };

          // Validate Slave Account
          const validation = await mt5Service.validateConnection(slaveDetails);
          
          // Create Running Strategy (initial state)
          const runResult = await createRunningStrategy(
            transaction.user_id,
            transaction.strategy_id,
            (transaction.plan_level as 'Premium' | 'Expert' | 'Pro') || 'Pro',
            Number(transaction.capital) || 0,
            {
              platform: slaveDetails.platform,
              mtAccountId: slaveDetails.id,
              mtAccountPassword: slaveDetails.password,
              mtAccountServer: slaveDetails.server
            }
          );

          if (runResult.success && runResult.id) {
            let finalStatus: 'running' | 'wrong-account-password' | 'wrong-account-id' | 'wrong-account-server-name' | 'disconnected' = 'running';

            if (!validation.success) {
              // Map validation error to DB status
              if (validation.error === 'Wrong-Password') finalStatus = 'wrong-account-password';
              else if (validation.error === 'Wrong-Id') finalStatus = 'wrong-account-id';
              else if (validation.error === 'Wrong-Server') finalStatus = 'wrong-account-server-name';
              else finalStatus = 'wrong-account-id'; // Default fallback
            } else {
              // If validation passed, start copy trading
              if (strategy.masterAccountId) {
                const masterDetails: MtAccountDetails = {
                  id: strategy.masterAccountId,
                  password: strategy.masterAccountPassword || '',
                  server: strategy.masterAccountServer || '',
                  platform: strategy.masterPlatform || 'MT5'
                };
                try {
                  await mt5Service.startCopyTrading(masterDetails, slaveDetails, runResult.id);
                } catch (copyError) {
                  console.error('Copy trading start failed:', copyError);
                  finalStatus = 'disconnected';
                }
              }
            }

            // Update status in DB (updates running_strategies and the initial modification)
            console.log(`Updating running strategy ${runResult.id} status to ${finalStatus}`);
            await updateRunningStrategyAdminStatus(runResult.id, finalStatus);
          }
        }
      } catch (connError) {
        console.error('Error connecting strategy:', connError);
        // We don't fail the request because payment was already approved
      }
    }

    return NextResponse.json({
      success: true,
      message: `Payment approved and ${transaction.amount} tokens added to user account`,
      transaction: updateResult.transaction,
      user: updateResult.user
    });
  } catch (error) {
    console.error('Error approving payment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve payment' },
      { status: 500 }
    );
  }
}