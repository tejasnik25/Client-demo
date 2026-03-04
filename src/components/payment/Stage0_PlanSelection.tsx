"use client";

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import { PaymentData } from '@/types';

interface Stage0Props {
  onNext: () => void;
  setPaymentData: React.Dispatch<React.SetStateAction<PaymentData | null>>;
  paymentData: PaymentData | null;
  strategy: any;
}

type LotOption = { amountUSD: number; lot: number };

const Stage0_PlanSelection = ({ onNext, setPaymentData, paymentData, strategy }: Stage0Props) => {
  // Derive base price for 1 Lot from strategy parameters
  const basePrice: number | null = useMemo(() => {
    const raw = (strategy?.parameters && (strategy.parameters as any).lotPricing) || '';
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        // Prefer an explicit lot=1 entry
        const one = arr.find((x: any) => Number(x.lot) === 1);
        const src = one || arr[0];
        const amt = Number(src.amountUSD);
        return Number.isFinite(amt) && amt > 0 ? amt : null;
      }
    } catch {}
    return null;
  }, [strategy]);

  const [selectedMultiplier, setSelectedMultiplier] = useState<number | null>(null);
  const [customLot, setCustomLot] = useState<string>('');
  const [showCustom, setShowCustom] = useState<boolean>(false);

  const applySelection = (lot: number) => {
    if (!basePrice) return;
    const amount = basePrice * lot;
    const lotLabel = `USD ${amount} – ${lot} Lot`;
    setPaymentData((prev) => ({
      ...(prev || {}),
      strategyId: strategy?.id,
      strategyName: strategy?.name,
      profit: strategy?.profit ?? 0,
      lotSize: lot,
      lotLabel,
      payable: amount,
    } as PaymentData));
  };

  const handleContinue = () => {
    if (paymentData?.payable != null) onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Lot Size</h2>
        <p className="text-gray-600">Choose the lot size configured by admin</p>
      </div>

      <div className="max-w-md space-y-4">
        {!basePrice ? (
          <div className="text-sm text-gray-500">No pricing configured for this strategy.</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {[1,2,3].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setSelectedMultiplier(m); setCustomLot(''); setShowCustom(false); applySelection(m); }}
                  className={`p-3 text-left rounded ${selectedMultiplier===m && !showCustom ? 'border-2 border-primary bg-primary/10' : 'border bg-white'} `}
                >
                  <div className="text-sm font-semibold">{m===1? 'Equal x1' : m===2 ? 'Double x2' : 'Triple x3'}</div>
                  <div className="text-xs text-gray-600">${(basePrice * m).toFixed(2)} required</div>
                  <div className="text-xs text-gray-400">×{m} trade volume</div>
                </button>
              ))}
            </div>

            <div>
              <button
                type="button"
                onClick={() => { setShowCustom(true); setSelectedMultiplier(null); setPaymentData((prev) => ({ ...(prev||{}), lotSize: undefined, lotLabel: undefined, payable: undefined } as any)); }}
                className="text-sm text-blue-600"
              >
                Custom ›
              </button>
              {showCustom && (
                <div className="mt-2">
                  <label className="text-sm text-gray-700">Enter value</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={customLot}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, '');
                      setCustomLot(v);
                      const n = Number(v || 0);
                      if (n > 0 && basePrice) {
                        applySelection(n);
                      }
                    }}
                    placeholder="Enter lot size"
                    className="mt-1 w-full p-2 border rounded bg-white"
                  />
                  <div className="text-xs text-gray-500 mt-1">Required investment: {customLot && Number(customLot) > 0 ? `$${(Number(customLot) * basePrice).toFixed(2)}` : `$${basePrice.toFixed(2)} (for 1)`}</div>
                </div>
              )}
            </div>
          </div>
        )}
        {paymentData?.lotLabel && (
          <div className="mt-2 text-sm text-gray-700">
            Selected: <span className="font-semibold">{paymentData.lotLabel}</span>
          </div>
        )}
        {paymentData?.payable != null && (
          <div className="mt-1 text-sm text-gray-700">
            Total amount: <span className="font-semibold">${paymentData.payable.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleContinue}
          disabled={!selectedKey}
          className="bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

export default Stage0_PlanSelection;

