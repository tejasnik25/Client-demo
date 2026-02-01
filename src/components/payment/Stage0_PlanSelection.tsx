"use client";

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { PaymentData } from '@/types';

interface Stage0Props {
  onNext: () => void;
  setPaymentData: React.Dispatch<React.SetStateAction<PaymentData | null>>;
  paymentData: PaymentData | null;
  strategy: any;
}

const Stage0_PlanSelection = ({ onNext, setPaymentData, paymentData, strategy }: Stage0Props) => {
  const [selectedPlan, setSelectedPlan] = useState<'Premium' | 'Expert' | 'Pro' | null>(
    (paymentData?.plan as 'Premium' | 'Expert' | 'Pro') || null
  );

  // Sync selected plan when paymentData.plan changes
  useEffect(() => {
    if (paymentData?.plan) {
      setSelectedPlan(paymentData.plan as 'Premium' | 'Expert' | 'Pro');
    }
  }, [paymentData?.plan]);

  const getPlanPrices = (s: any) => {
    if (!s) return { Premium: 5000, Expert: 10000, Pro: 20000 };
    
    if (s.planPrices) {
      return {
        Premium: s.planPrices.Premium || 5000,
        Expert: s.planPrices.Expert || 10000,
        Pro: s.planPrices.Pro || 20000
      };
    }
    
    return { Premium: 5000, Expert: 10000, Pro: 20000 };
  };

  const getPlanPercent = (plan: 'Premium' | 'Expert' | 'Pro') => {
    if (!strategy?.planDetails?.[plan]?.percent) {
      const defaults = { Premium: 10, Expert: 15, Pro: 20 };
      return defaults[plan];
    }
    return strategy.planDetails[plan].percent;
  };

  const prices = getPlanPrices(strategy);

  const handleSelectPlan = (plan: 'Premium' | 'Expert' | 'Pro') => {
    setSelectedPlan(plan);
    setPaymentData((prev) => ({
      ...prev,
      plan,
      strategyId: strategy?.id,
      strategyName: strategy?.name,
      profit: strategy?.profit ?? 0,
    } as PaymentData));
  };

  const handleContinue = () => {
    if (selectedPlan) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Your Plan</h2>
        <p className="text-gray-600">Choose the plan that best fits your investment needs</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['Pro', 'Expert', 'Premium'] as const).map((plan) => {
          const price = prices[plan];
          const percent = getPlanPercent(plan);
          const isSelected = selectedPlan === plan;

          return (
            <button
              key={plan}
              onClick={() => handleSelectPlan(plan)}
              className={`p-6 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-[#00d09c] bg-green-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-4">{plan}</h3>
                <div className="mb-4">
                  <div className="text-3xl font-bold text-gray-900">${price.toLocaleString()}</div>
                  <div className="text-m text-gray-900 mt-4">{percent}% of your capital for 1 year</div>
                </div>
                {isSelected && (
                  <div className="mt-2">
                    <span className="inline-block px-3 py-1 bg-[#00d09c] text-white text-xs font-semibold rounded-full">
                      Selected
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleContinue}
          disabled={!selectedPlan}
          className="bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

export default Stage0_PlanSelection;

