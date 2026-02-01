import { create } from 'zustand';

export type PaymentMethod = 'USDT_ERC20' | 'USDT_TRC20' | 'UPI';
export type MT4MT5Type = 'MT4' | 'MT5';

interface PaymentState {
  stage: number;
  strategyId: string | null;
  plan: 'Pro' | 'Expert' | 'Premium' | null;
  capital: number | null;
  payable: number | null;
  method: PaymentMethod | null;
  mt4mt5: {
    type: MT4MT5Type | null;
    id: string | null;
    pass: string | null;
    server: string | null;
  };
  txId: string | null;
  proofUrl: string | null;
  expiresAt: Date | null;

  setStage: (stage: number) => void;
  setStrategyId: (id: string) => void;
  setPlan: (plan: 'Pro' | 'Expert' | 'Premium') => void;
  setCapital: (capital: number) => void;
  setPayable: (payable: number) => void;
  setMethod: (method: PaymentMethod) => void;
  setMt4mt5: (details: Partial<PaymentState['mt4mt5']>) => void;
  setTxId: (txId: string) => void;
  setProofUrl: (url: string) => void;
  setExpiresAt: (date: Date) => void;
  reset: () => void;
}

const initialState = {
  stage: 1,
  strategyId: null,
  plan: null,
  capital: null,
  payable: null,
  method: null,
  mt4mt5: {
    type: null,
    id: null,
    pass: null,
    server: null,
  },
  txId: null,
  proofUrl: null,
  expiresAt: null,
};

export const usePaymentStore = create<PaymentState>((set) => ({
  ...initialState,
  setStage: (stage) => set({ stage }),
  setStrategyId: (id) => set({ strategyId: id }),
  setPlan: (plan) => set({ plan }),
  setCapital: (capital) => set({ capital }),
  setPayable: (payable) => set({ payable }),
  setMethod: (method) => set({ method }),
  setMt4mt5: (details) => set((state) => ({ mt4mt5: { ...state.mt4mt5, ...details } })),
  setTxId: (txId) => set({ txId }),
  setProofUrl: (url) => set({ proofUrl: url }),
  setExpiresAt: (date) => set({ expiresAt: date }),
  reset: () => set(initialState),
}));