
import { getCopyTradingProvider, ICopyTradingProvider } from './copy-trading-service';

export interface MtAccountDetails {
  id: string;
  password: string;
  server: string;
  platform: 'MT4' | 'MT5';
}

export type ConnectionError = 'Wrong-Password' | 'Wrong-Id' | 'Wrong-Server' | 'Connection-Failed' | 'Service-Error' | string | null;

/**
 * Service to handle MetaTrader 4/5 connections and Copy Trading logic.
 * Wraps the underlying ICopyTradingProvider (Mock or Http).
 */
export class Mt5Service {
  private provider: ICopyTradingProvider;

  constructor() {
    this.provider = getCopyTradingProvider();
  }
  
  /**
   * Validates the connection to the MT4/MT5 account.
   */
  async validateConnection(details: MtAccountDetails): Promise<{ success: boolean; error: ConnectionError }> {
    console.log(`[MT5 Service] Validating connection for account: ${details.id}`);
    
    const result = await this.provider.validateAccount(details);
    
    if (!result.isValid) {
      // Map generic string errors to specific union type if possible, or default
      if (result.error === 'Invalid Password') return { success: false, error: 'Wrong-Password' };
      if (result.error === 'Invalid Account ID') return { success: false, error: 'Wrong-Id' };
      if (result.error === 'Server Not Found') return { success: false, error: 'Wrong-Server' };
      
      // Handle System/Service Errors
      if (result.error && (
          result.error.includes('MT5 Application not found') || 
          result.error.includes('missing MetaTrader5 library') ||
          result.error.includes('ImportError') ||
          result.error.includes('MT5 Init Failed')
      )) {
          // Pass the real error to the user so they know what to fix
          return { success: false, error: result.error };
      }

      return { success: false, error: result.error || 'Connection-Failed' };
    }

    return { success: true, error: null };
  }

  /**
   * Starts the copy trading process between Master and Slave.
   */
  async startCopyTrading(master: MtAccountDetails, slave: MtAccountDetails, runningStrategyId: string = 'unknown') {
    console.log(`[MT5 Service] Starting Copy Trading...`);
    
    const result = await this.provider.subscribe({
      id: runningStrategyId,
      masterId: master.id,
      slaveId: slave.id,
      status: 'active',
      settings: {
        riskType: 'balance_multiplier',
        riskValue: 1.0
      }
    }, master, slave);

    if (!result.success) {
      throw new Error(result.error || 'Failed to start copy trading');
    }

    return { success: true, message: 'Copy trading started successfully', subscriptionId: result.subscriptionId };
  }

  /**
   * Stops the copy trading process.
   */
  async stopCopyTrading(runningStrategyId: string) {
    console.log(`[MT5 Service] Stopping Copy Trading for ${runningStrategyId}`);
    const result = await this.provider.unsubscribe(runningStrategyId);
    return result;
  }

  /**
   * Closes all open positions for the given subscription/slave.
   */
  async closeAllPositions(runningStrategyId: string) {
    console.log(`[MT5 Service] Closing all open positions for ${runningStrategyId}`);
    const result = await this.provider.closeAllPositions(runningStrategyId);
    return result;
  }

  /**
   * Fetch current open positions for a subscription/slave.
   */
  async getOpenPositions(runningStrategyId: string) {
    console.log(`[MT5 Service] Getting open positions for ${runningStrategyId}`);
    const result = await this.provider.getOpenPositions(runningStrategyId);
    return result;
  }

  /**
   * Updates the slave details (e.g. password change).
   * For now, this might require a re-subscription in many engines.
   */
  async updateSlaveDetails(slaveId: string, newDetails: MtAccountDetails) {
    console.log(`[MT5 Service] Updating slave details for ${slaveId}`);
    // In a real scenario, you might need to update the specific subscription
    return { success: true };
  }

  /**
   * Checks the live status of a running strategy.
   */
  async checkConnectionStatus(runningStrategyId: string) {
      return await this.provider.getSubscriptionStatus(runningStrategyId);
  }
}

export const mt5Service = new Mt5Service();
