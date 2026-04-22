export interface PaymentData {
  strategyId?: string;
  plan?: 'Pro' | 'Expert' | 'Premium' | string;
  strategyName?: string;
  strategyCurrency?: string;
  profit?: number;
  method?: 'UPI' | 'USDT_TRC20' | 'USDT_ERC20';
  lotSize?: number;
  lotLabel?: string;
  capital?: number;
  payable?: number;
  usdToInrRate?: number;
  transactionId?: string;
  proofUrl?: string;
  status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'in-process';
}
