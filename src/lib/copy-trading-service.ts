
import { MtAccountDetails } from './mt5-service';

export type CopyTradingStatus = 'active' | 'paused' | 'error' | 'disconnected';

export interface CopyTradingSubscription {
  id: string; // The running_strategy_id
  masterId: string;
  slaveId: string;
  status: CopyTradingStatus;
  errorMessage?: string;
  settings: {
    riskType: 'fixed_lot' | 'balance_multiplier' | 'equity_ratio';
    riskValue: number;
  };
}

export interface ICopyTradingProvider {
  validateAccount(details: MtAccountDetails): Promise<{ isValid: boolean; error?: string }>;
  subscribe(subscription: CopyTradingSubscription, masterDetails: MtAccountDetails, slaveDetails: MtAccountDetails): Promise<{ success: boolean; subscriptionId?: string; error?: string }>;
  unsubscribe(subscriptionId: string): Promise<{ success: boolean; error?: string }>;
  pauseSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }>;
  resumeSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }>;
  getSubscriptionStatus(subscriptionId: string): Promise<{ 
    status: CopyTradingStatus; 
    error?: string; 
    detail?: string; 
    updated_at?: number;
    master_positions?: number;
    slave_positions?: number;
    last_action?: string;
  }>;
}

/**
 * Mock Provider for Development/Demo
 * Simulates network latency and potential failures
 */
export class MockCopyTradingProvider implements ICopyTradingProvider {
  private subscriptions: Map<string, CopyTradingStatus> = new Map();

  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async validateAccount(details: MtAccountDetails): Promise<{ isValid: boolean; error?: string }> {
    await this.delay(800); // Simulate network latency

    if (details.password === 'wrong') return { isValid: false, error: 'Invalid Password' };
    if (details.id === '000000') return { isValid: false, error: 'Invalid Account ID' };
    if (details.server === 'invalid-server') return { isValid: false, error: 'Server Not Found' };
    
    return { isValid: true };
  }

  async subscribe(subscription: CopyTradingSubscription, master: MtAccountDetails, slave: MtAccountDetails): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    await this.delay(1000);
    console.log(`[MockProvider] Subscribing ${slave.id} to ${master.id} (Risk: ${subscription.settings.riskType})`);
    
    this.subscriptions.set(subscription.id, 'active');
    return { success: true, subscriptionId: subscription.id };
  }

  async unsubscribe(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
    await this.delay(500);
    console.log(`[MockProvider] Unsubscribing ${subscriptionId}`);
    this.subscriptions.delete(subscriptionId);
    return { success: true };
  }

  async pauseSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
    await this.delay(300);
    if (this.subscriptions.has(subscriptionId)) {
      this.subscriptions.set(subscriptionId, 'paused');
      return { success: true };
    }
    return { success: false, error: 'Subscription not found' };
  }

  async resumeSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
    await this.delay(300);
    if (this.subscriptions.has(subscriptionId)) {
      this.subscriptions.set(subscriptionId, 'active');
      return { success: true };
    }
    return { success: false, error: 'Subscription not found' };
  }

  async getSubscriptionStatus(subscriptionId: string): Promise<{ status: CopyTradingStatus; error?: string; detail?: string; updated_at?: number }> {
    await this.delay(200);
    const status = this.subscriptions.get(subscriptionId);
    if (!status) return { status: 'disconnected', detail: 'Mock: Subscription not found' };
    return { status, detail: 'Mock: Connection healthy' };
  }
}

/**
 * Production Provider using external API
 * This is the code you would use in production by setting the implementation
 */
export class HttpCopyTradingProvider implements ICopyTradingProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    // Remove trailing slash if present to avoid double slashes
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.apiKey = apiKey;
  }

  private async request(endpoint: string, method: 'GET' | 'POST', body?: any) {
    const awsUrl = 'http://15.206.157.59:8000';
    const localUrl = 'http://127.0.0.1:8000';
    
    // Build list of URLs to try
    const urls: string[] = [];
    
    // 1. Configured URL (if valid)
    if (this.baseUrl && !this.baseUrl.includes('mock')) {
        urls.push(this.baseUrl);
    }
    
    // 2. Localhost (always try local fallback for RDP)
    if (!urls.some(u => u.includes('127.0.0.1') || u.includes('localhost'))) {
        urls.push(localUrl);
    }

    // 3. AWS IP (Legacy fallback)
    if (!urls.some(u => u.includes('15.206.157.59'))) {
        urls.push(awsUrl);
    }

    let lastError: any;

    for (const base of urls) {
        const url = `${base}${endpoint}`;
        try {
          const res = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            },
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store'
          });
          
          if (!res.ok) {
            // If it's a 404/500 from the server, it means we connected but something is wrong.
            // We should probably NOT failover if we got a valid HTTP response (even error) from the primary?
            // BUT, for 404 (Subscription not found), it might exist on the other server.
            // For now, let's treat any error as a reason to try the fallback, 
            // because "Connection Issue" is the main user complaint.
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        } catch (e: any) {
          console.warn(`[CopyTrading] Request failed to ${url}: ${e.message}`);
          lastError = e;
          // Continue to next URL
        }
    }

    // If we exhausted all URLs
    console.error(`[CopyTrading] All connection attempts failed.`);
    if (lastError) {
        lastError.message = `${lastError.message} (Target: ${this.baseUrl})`;
        throw lastError;
    }
    throw new Error('Connection failed');
  }

  async validateAccount(details: MtAccountDetails): Promise<{ isValid: boolean; error?: string }> {
    try {
      const res = await this.request('/accounts/validate', 'POST', details);
      return { isValid: res.isValid, error: res.error };
    } catch (e: any) {
      // Return the actual connection error to help debugging
      const target = this.baseUrl.includes('localhost') ? `${this.baseUrl} (Env Var seems missing - Set COPY_TRADING_API_URL)` : this.baseUrl;
      return { isValid: false, error: `Connection Failed to ${target}. Check Firewall.` };
    }
  }

  async subscribe(sub: CopyTradingSubscription, master: MtAccountDetails, slave: MtAccountDetails) {
    try {
      const res = await this.request('/subscriptions', 'POST', {
        externalId: sub.id,
        master,
        slave,
        settings: sub.settings
      });
      return { success: res.success, subscriptionId: res.id, error: res.error };
    } catch (e: any) {
      return { success: false, error: e.message || 'Connection Failed' };
    }
  }

  async unsubscribe(id: string) {
    try {
      await this.request(`/subscriptions/${id}`, 'POST', { action: 'delete' }); // Using POST for safety or DELETE
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Failed' };
    }
  }

  async pauseSubscription(id: string) { return this.action(id, 'pause'); }
  async resumeSubscription(id: string) { return this.action(id, 'resume'); }

  private async action(id: string, action: string) {
    try {
      await this.request(`/subscriptions/${id}/${action}`, 'POST');
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Failed' };
    }
  }

  async getSubscriptionStatus(id: string) {
    try {
      const res = await this.request(`/subscriptions/${id}/status`, 'GET');
      return { 
        status: res.status, 
        error: res.error, // Pass through error from backend
        detail: res.detail, 
        updated_at: res.updated_at,
        master_positions: res.master_positions,
        slave_positions: res.slave_positions,
        last_action: res.last_action
      };
    } catch (e: any) {
      // Return the error message which now includes the target URL
      const target = this.baseUrl.includes('localhost') ? `${this.baseUrl} (Env Var COPY_TRADING_API_URL seems missing)` : this.baseUrl;
      const errorMsg = e.message || String(e);
      return { status: 'error' as CopyTradingStatus, error: `${errorMsg} [Target: ${target}]` };
    }
  }
}

// Factory to get the correct provider based on ENV
export function getCopyTradingProvider(): ICopyTradingProvider {
  const envUrl = process.env.COPY_TRADING_API_URL || process.env.NEXT_PUBLIC_COPY_TRADING_API_URL;
  const isMock = process.env.USE_MOCK_TRADING === 'true';
  
  if (isMock) {
    console.log('[CopyTrading] Using Mock Provider');
    return new MockCopyTradingProvider();
  }

  // Determine URL based on environment if not explicitly set
  let finalUrl = envUrl;
  
  if (!finalUrl) {
    if (process.env.NODE_ENV === 'development') {
      // Default to AWS IP even in dev if env var is missing, as per user requirement
      finalUrl = 'http://15.206.157.59:8000';
      console.warn('[CopyTrading] COPY_TRADING_API_URL missing in dev. Defaulting to AWS IP: http://15.206.157.59:8000');
    } else {
      // Fallback for production if forgot to set env var (legacy behavior)
      finalUrl = 'http://15.206.157.59:8000'; 
      console.warn(`[CopyTrading] COPY_TRADING_API_URL missing in prod. Defaulting to ${finalUrl}`);
    }
  }

  // Remove trailing slash if present
  if (finalUrl.endsWith('/')) {
    finalUrl = finalUrl.slice(0, -1);
  }

  console.log(`[CopyTrading] Connecting to Provider at: ${finalUrl}`);

  return new HttpCopyTradingProvider(
    finalUrl,
    process.env.COPY_TRADING_API_KEY || '9f236bab9fe640848a142f7d17a1960c8582d3ac18a96cc7ec86bb23c10ad6ad'
  );
}
