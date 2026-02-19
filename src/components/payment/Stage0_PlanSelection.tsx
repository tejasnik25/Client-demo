"use client";

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaymentData } from '@/types';

interface Stage0Props {
  onNext: () => void;
  setPaymentData: React.Dispatch<React.SetStateAction<PaymentData | null>>;
  paymentData: PaymentData | null;
  strategy: any;
}

type LotOption = { amountUSD: number; lot: number };

const Stage0_PlanSelection = ({ onNext, setPaymentData, paymentData, strategy }: Stage0Props) => {
  const lotOptions: LotOption[] = useMemo(() => {
    const raw = (strategy?.parameters && (strategy.parameters as any).lotPricing) || '';
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr
          .map((x) => ({
            amountUSD: Number(x.amountUSD),
            lot: Number(x.lot),
          }))
          .filter((x) => x.amountUSD > 0 && x.lot > 0)
          .sort((a, b) => a.amountUSD - b.amountUSD);
      }
    } catch {}
    return [];
  }, [strategy]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const handleSelect = (key: string) => {
    setSelectedKey(key);
    const [amountStr, lotStr] = key.split('|');
    const amountUSD = Number(amountStr);
    const lot = Number(lotStr);
    const lotLabel = `USD ${amountUSD} – ${lot} Lot`;
    setPaymentData((prev) => ({
      ...(prev || {}),
      strategyId: strategy?.id,
      strategyName: strategy?.name,
      profit: strategy?.profit ?? 0,
      lotSize: lot,
      lotLabel,
      payable: amountUSD,
    } as PaymentData));
  };

  const handleContinue = () => {
    if (selectedKey) onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Lot Size</h2>
        <p className="text-gray-600">Choose the lot size configured by admin</p>
      </div>

      <div className="max-w-md">
        <Select onValueChange={handleSelect} value={selectedKey || undefined}>
          <SelectTrigger className="bg-white text-gray-900 border border-gray-300">
            <SelectValue placeholder="Select Lot Size" />
          </SelectTrigger>
          <SelectContent className="bg-white text-gray-900 border border-gray-200">
            {lotOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No lot sizes available</div>
            ) : (
              lotOptions.map((opt) => {
                const key = `${opt.amountUSD}|${opt.lot}`;
                const label = `USD ${opt.amountUSD} – ${opt.lot} Lot`;
                return (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                );
              })
            )}
          </SelectContent>
        </Select>
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

