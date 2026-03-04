"use client";

import { useMemo, useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { PaymentData } from '@/types';
import { FiHelpCircle, FiCreditCard } from 'react-icons/fi';

interface Stage0Props {
  onNext: () => void;
  setPaymentData: React.Dispatch<React.SetStateAction<PaymentData | null>>;
  paymentData: PaymentData | null;
  strategy: any;
}

const Stage0_PlanSelection = ({ onNext, setPaymentData, paymentData, strategy }: Stage0Props) => {
  const [walletBalance, setWalletBalance] = useState<number>(0);
  
  useEffect(() => {
    fetch('/api/profile')
      .then(res => res.json())
      .then(data => {
        setWalletBalance(data?.user?.walletBalance || 0);
      })
      .catch(() => setWalletBalance(0));
  }, []);

  const basePrice: number | null = useMemo(() => {
    const raw = (strategy?.parameters && (strategy.parameters as any).lotPricing) || '';
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        const one = arr.find((x: any) => Number(x.lot) === 1);
        const src = one || arr[0];
        const amt = Number(src.amountUSD);
        return Number.isFinite(amt) && amt > 0 ? amt : null;
      }
    } catch {}
    return null;
  }, [strategy]);

  const [selectedMultiplier, setSelectedMultiplier] = useState<number | null>(paymentData?.lotSize || 1);
  const [customLot, setCustomLot] = useState<string>(paymentData?.lotSize && ![1,2,3].includes(paymentData.lotSize) ? String(paymentData.lotSize) : '');
  const [showCustom, setShowCustom] = useState<boolean>(paymentData?.lotSize ? ![1,2,3].includes(paymentData.lotSize) : false);

  const applySelection = (lot: number) => {
    if (!basePrice) return;
    const amount = basePrice * lot;
    setPaymentData((prev) => ({
      ...(prev || {}),
      strategyId: strategy?.id,
      strategyName: strategy?.name,
      profit: strategy?.profit ?? 0,
      lotSize: lot,
      payable: amount,
    } as PaymentData));
  };

  const handleContinue = () => {
    if (paymentData?.payable != null) onNext();
  };

  const commission = strategy?.parameters?.commission || strategy?.parameters?.Commission || '30%';

  return (
    <div className="flex flex-col gap-6 text-gray-900">
      {/* Strategy Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
          {strategy?.imageUrl ? (
            <img src={strategy.imageUrl} alt={strategy.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">
              {strategy?.name?.charAt(0)}
            </div>
          )}
        </div>
        <div>
          <h2 className="text-lg font-bold leading-tight">{strategy?.name || 'Strategy'}</h2>
          <p className="text-xs text-gray-500 font-medium">{commission} commission</p>
        </div>
      </div>

      {/* Wallet Info */}
      <div className="flex items-center justify-between py-4 border-y border-gray-100">
        <span className="text-sm font-bold text-gray-700">Funds in Wallet</span>
        <div className="flex items-center gap-2">
          <FiCreditCard className="text-gray-400" />
          <span className="text-sm font-bold">{walletBalance.toFixed(2)} USD</span>
        </div>
      </div>

      {/* Copy Proportion Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-gray-800">Copy proportion</span>
            <FiHelpCircle className="text-gray-400 w-4 h-4 cursor-help" />
          </div>
          <button 
            onClick={() => setShowCustom(!showCustom)} 
            className="text-xs font-bold text-blue-600 hover:text-blue-700"
          >
            {showCustom ? '< Default' : 'Custom >'}
          </button>
        </div>

        {!basePrice ? (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg text-xs">
            No pricing configured for this strategy.
          </div>
        ) : !showCustom ? (
          /* Multiplier Grid */
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setSelectedMultiplier(m);
                  applySelection(m);
                }}
                className={`p-4 text-center rounded-2xl transition-all duration-200 border-2 ${
                  selectedMultiplier === m
                    ? 'border-blue-600 bg-blue-600 text-white shadow-lg'
                    : 'border-transparent bg-gray-50 text-gray-900 hover:bg-gray-100'
                }`}
              >
                <div className="text-sm font-bold mb-1">
                  {m === 1 ? 'Equal' : m === 2 ? 'Double' : 'Triple'} x{m}
                </div>
                <div className={`text-[10px] ${selectedMultiplier === m ? 'text-blue-100' : 'text-gray-500'} font-medium`}>
                  ${(basePrice * m).toFixed(2)} required
                </div>
                <div className={`text-[10px] mt-2 ${selectedMultiplier === m ? 'text-blue-200' : 'text-gray-400'}`}>
                  ×{m} trade volume
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Custom Input */
          <div className="space-y-3">
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider z-10">
                Enter value
              </label>
              <div className="flex items-center px-4 py-4 border-2 border-gray-200 rounded-2xl focus-within:border-blue-600 transition-all">
                <span className="text-lg font-bold text-gray-400 mr-1">×</span>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={customLot}
                  onChange={(e) => {
                    setCustomLot(e.target.value);
                    const n = parseFloat(e.target.value);
                    if (!isNaN(n) && n > 0) applySelection(n);
                  }}
                  className="w-full bg-transparent focus:outline-none text-lg font-bold text-gray-900"
                  placeholder="1.0"
                />
              </div>
            </div>
            {customLot && parseFloat(customLot) > 0 && (
              <p className="text-xs font-bold text-gray-500 ml-1">
                Required investment: ${ (parseFloat(customLot) * basePrice).toFixed(2) }
              </p>
            )}
          </div>
        )}
      </div>

      {/* Support Funds Toggle */}
      <div className="flex items-center gap-4 py-2">
        <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 cursor-pointer">
          <div className="h-4 w-4 rounded-full bg-white transition-transform translate-x-1" />
        </div>
        <p className="text-[11px] leading-relaxed text-gray-500 font-medium">
          Add <span className="text-gray-800 font-bold">support funds</span> to protect your investment from unexpected market movements
        </p>
      </div>

      {/* Summary Section */}
      <div className="mt-4 space-y-3">
        <h3 className="text-sm font-bold text-gray-800">Summary</h3>
        <div className="space-y-2.5">
          <div className="flex items-end gap-2 text-xs">
            <span className="text-gray-500 font-medium whitespace-nowrap">Copy proportion</span>
            <div className="flex-1 border-b border-dotted border-gray-300 mb-1" />
            <span className="text-gray-900 font-bold">
              {!showCustom ? (selectedMultiplier === 1 ? 'Equal x1' : selectedMultiplier === 2 ? 'Double x2' : 'Triple x3') : `x${customLot || '0'}`}
            </span>
          </div>
          <div className="flex items-end gap-2 text-xs">
            <span className="text-gray-500 font-medium whitespace-nowrap">Required Investment</span>
            <div className="flex-1 border-b border-dotted border-gray-300 mb-1" />
            <span className="text-gray-900 font-bold">${(paymentData?.payable || 0).toFixed(2)}</span>
          </div>
          <div className="flex items-end gap-2 text-xs">
            <span className="text-gray-500 font-medium whitespace-nowrap">Support funds</span>
            <div className="flex-1 border-b border-dotted border-gray-300 mb-1" />
            <span className="text-gray-900 font-bold">$0.00</span>
          </div>
          <div className="flex items-end gap-2 text-sm pt-1">
            <span className="text-gray-900 font-black whitespace-nowrap">Total</span>
            <div className="flex-1 border-b border-dotted border-gray-400 mb-1.5" />
            <span className="text-gray-900 font-black">${(paymentData?.payable || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-4">
        <Button
          onClick={handleContinue}
          disabled={!paymentData?.payable}
          className="w-full py-4 rounded-2xl text-base font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all disabled:opacity-50"
        >
          Start copying
        </Button>
      </div>
    </div>
  );
};

export default Stage0_PlanSelection;

