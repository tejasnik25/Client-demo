
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
  closeAllPositions(subscriptionId: string): Promise<{ success: boolean; error?: string }>;
  getOpenPositions(subscriptionId: string): Promise<{ success: boolean; positions: any[]; error?: string }>;
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

  async closeAllPositions(_subscriptionId: string): Promise<{ success: boolean; error?: string }> {
    await this.delay(300);
    console.log(`[MockProvider] Closing all positions for ${_subscriptionId}`);
    return { success: true };
  }

  async getSubscriptionStatus(subscriptionId: string): Promise<{ status: CopyTradingStatus; error?: string; detail?: string; updated_at?: number }> {
    await this.delay(200);
    const status = this.subscriptions.get(subscriptionId);
    if (!status) return { status: 'disconnected', detail: 'Mock: Subscription not found' };
    return { status, detail: 'Mock: Connection healthy' };
  }

  async getOpenPositions(_subscriptionId: string): Promise<{ success: boolean; positions: any[]; error?: string }> {
    await this.delay(100);
    return { success: true, positions: [] };
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
    const isDev = process.env.NODE_ENV !== 'production';
    const isVercel = typeof process.env.VERCEL === 'string';

    // On Vercel (serverless), 127.0.0.1 is the Vercel server itself, not the Python service.
    // Only use the single configured URL (or AWS) in production to avoid ECONNREFUSED.
    const urls: string[] = [];
    if (this.baseUrl && !this.baseUrl.includes('mock')) {
      urls.push(this.baseUrl);
    } else if (!isDev && !this.baseUrl) {
      console.log('[CopyTrading] Using default AWS Provider (No custom URL configured).');
    }
    if (!isVercel && !urls.some(u => u.includes('127.0.0.1') || u.includes('localhost'))) {
      urls.push(localUrl);
    }
    if (!urls.some(u => u.includes('15.206.157.59'))) {
      urls.push(awsUrl);
    }

    let lastError: any;

    for (const base of urls) {
        const url = `${base}${endpoint}`;
        try {
          const controller = new AbortController();
          // Increased timeout to 60s for operations like login/initialization
          const timeoutId = setTimeout(() => controller.abort(), 60000); 

          const res = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`
            },
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (!res.ok) {
            const errorText = await res.text().catch(() => res.statusText);
            if (res.status === 404) {
              lastError = new Error(`404: Not Found`);
              continue; // Try next provider (it might be on another server)
            }
            throw new Error(`HTTP ${res.status}: ${errorText}`);
          }
          return res.json();
        } catch (e: any) {
          if (e.name === 'AbortError') {
            console.warn(`[CopyTrading] Request to ${url} timed out (60s).`);
          } else {
            // Only log if it's NOT a 404 (which is expected if multi-server)
            if (!e.message.includes('404')) {
              console.warn(`[CopyTrading] Connection failed to ${url}: ${e.message}`);
            }
          }
          lastError = e;
          // Continue to next URL
        }
    }

    // If we exhausted all URLs and have an error
    if (lastError) {
        if (lastError.message.includes('404')) {
          throw new Error('Subscription not found (404)');
        }
        console.error(`[CopyTrading] All ${urls.length} connection attempts failed.`);
        throw lastError;
    }
    throw new Error('Connection failed: No provider available');
  }

  async validateAccount(details: MtAccountDetails): Promise<{ isValid: boolean; error?: string }> {
    try {
      const res = await this.request('/accounts/validate', 'POST', details);
      return { isValid: res.isValid, error: res.error };
    } catch (e: any) {
      // If it's an HTTP error from our service (like 403), pass it through
      if (e.message && e.message.includes('HTTP')) {
        return { isValid: false, error: e.message };
      }
      // Return the actual connection error to help debugging
      const target = this.baseUrl.includes('localhost') ? `${this.baseUrl} (Env Var missing - Set COPY_TRADING_API_URL or COPY_TRADING_URL)` : this.baseUrl;
      return { isValid: false, error: `Connection Failed to ${target}. Check Firewall. (${e.message})` };
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

  async closeAllPositions(id: string) {
    try {
      await this.request(`/subscriptions/${id}/close-all`, 'POST');
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Failed' };
    }
  }

  async getOpenPositions(id: string) {
    try {
      const res = await this.request(`/subscriptions/${id}/positions`, 'GET');
      const positions = Array.isArray(res?.positions) ? res.positions : (Array.isArray(res) ? res : []);
      return { success: true, positions };
    } catch (e: any) {
      return { success: false, positions: [], error: e?.message || 'Failed' };
    }
  }

  async getSubscriptionStatus(id: string) {
    try {
      const res = await this.request(`/subscriptions/${id}/status`, 'GET');
      return {
        status: res.status as CopyTradingStatus,
        error: res.error,
        detail: res.detail,
        updated_at: res.updated_at,
        master_positions: res.master_positions,
        slave_positions: res.slave_positions,
        last_action: res.last_action
      };
    } catch (e: any) {
      // If it's an HTTP error (like 403), return it in the detail
      if (e.message && e.message.includes('HTTP')) {
        return { status: 'error' as CopyTradingStatus, detail: e.message };
      }
      // Treat any connection failure as a temporary disconnection
      const target = this.baseUrl.includes('localhost') ? `${this.baseUrl} (Env Var COPY_TRADING_API_URL/COPY_TRADING_URL missing)` : this.baseUrl;
      const errorMsg = e.message || String(e);
      return { status: 'disconnected' as CopyTradingStatus, error: `${errorMsg} [Target: ${target}]` };
    }
  }
}

// Factory to get the correct provider based on ENV
export function getCopyTradingProvider(): ICopyTradingProvider {
  const envUrl = 
    process.env.COPY_TRADING_API_URL ||
    process.env.COPY_TRADING_URL ||
    process.env.NEXT_PUBLIC_COPY_TRADING_API_URL ||
    process.env.NEXT_PUBLIC_COPY_TRADING_URL;
  const isMock = process.env.USE_MOCK_TRADING === 'true';
  
  if (isMock) {
    console.log('[CopyTrading] Using Mock Provider');
    return new MockCopyTradingProvider();
  }

  // Determine URL based on environment if not explicitly set
  let finalUrl = (envUrl || '').trim();
  
  if (finalUrl) {
    // Log which variable was used (masked for security if needed, but URL is usually public-ish)
    console.log(`[CopyTrading] Found configuration URL: ${finalUrl.replace(/(http[s]?:\/\/)([^@]+@)?(.*)/, '$1***@$3')}`);
  } else {
    if (process.env.NODE_ENV === 'development') {
      finalUrl = 'http://127.0.0.1:8000';
      console.warn('[CopyTrading] COPY_TRADING_API_URL/COPY_TRADING_URL missing in dev. Defaulting to http://127.0.0.1:8000');
    } else {
      console.warn('[CopyTrading] Provider URL missing in production. Defaulting to AWS IP: http://15.206.157.59:8000');
      // Use AWS IP as default in production if env var is missing
      finalUrl = 'http://15.206.157.59:8000';
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
