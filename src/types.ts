export interface PaymentData {
  strategyId?: string;
  plan?: 'Pro' | 'Expert' | 'Premium' | string;
  strategyName?: string;
  method?: 'UPI' | 'USDT_TRC20' | 'USDT_ERC20';
  mt4mt5?: {
    type: 'MT4' | 'MT5';
    id: string;
    password: string;
    server: string;
  };
  capital?: number;
  payable?: number;
  usdToInrRate?: number;
  transactionId?: string;
  proofUrl?: string;
  status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'in-process';
}