'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Timer from '@/components/payment/Timer';
import Stage0_PlanSelection from '@/components/payment/Stage0_PlanSelection';
import Stage1_MethodSelection from '@/components/payment/Stage1_MethodSelection';
import Stage4_Review from '@/components/payment/Stage4_Review';
import Stage5_FinalPayment from '@/components/payment/Stage5_FinalPayment';
import { PaymentData } from '@/types';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

const PaymentContent = () => {
  const [stage, setStage] = useState(1);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [strategy, setStrategy] = useState<any>(null);
  const [completed, setCompleted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const strategyId = searchParams.get('strategy') ?? searchParams.get('strategyId');
    const plan = searchParams.get('plan');
    const renewal = searchParams.get('renewal') === 'true';
    const runningStrategyId = searchParams.get('runningStrategyId');

    if (strategyId) {
      // Fetch all strategies and find the one with matching ID
      fetch('/api/strategies')
        .then(res => res.json())
        .then(data => {
          const foundStrategy = data.strategies?.find((s: any) => s.id === strategyId);
          if (foundStrategy) {
            setStrategy(foundStrategy);
            setPaymentData((prevData: PaymentData | null) => ({
              ...(prevData ?? {}),
              strategyId,
              plan: plan || prevData?.plan,
              strategyName: foundStrategy?.name ?? '',
              profit: foundStrategy?.profit ?? 0,
              isRenewal: renewal,
              runningStrategyId: runningStrategyId || undefined,
            } as PaymentData));
          }
        })
        .catch(() => {
          // Even if strategy fetch fails, keep the provided params
          const strategyId = searchParams.get('strategy') ?? searchParams.get('strategyId');
          const plan = searchParams.get('plan');
          const renewal = searchParams.get('renewal') === 'true';
          const runningStrategyId = searchParams.get('runningStrategyId');
          setPaymentData((prevData: PaymentData | null) => ({
            ...(prevData ?? {}),
            strategyId,
            plan,
            isRenewal: renewal,
            runningStrategyId: runningStrategyId || undefined,
          } as PaymentData));
        });
    }
  }, [searchParams]);

  const handleNext = () => {
    if (stage < 4) {
      setStage(stage + 1);
    }
  };
  const handleBack = () => {
    if (stage > 1) {
      setStage(stage - 1);
    }
  };
  const handleEditStage = (target: number) => setStage(target);

  const handleTimeout = async () => {
    if (paymentData?.transactionId) {
      try {
        await fetch(`/api/payments/${paymentData.transactionId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'EXPIRED' }),
        });
      } catch (error) {
        console.error('Failed to update payment status:', error);
      }
    }
  };

  const handleCancel = async () => {
    if (paymentData?.transactionId) {
      try {
        await fetch(`/api/payments/${paymentData.transactionId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'CANCELLED' }),
        });
      } catch (error) {
        console.error('Failed to update payment status:', error);
      }
    }
    router.push('/strategies');
  }

  const renderStage = () => {
    switch (stage) {
      case 1:
        return <Stage0_PlanSelection onNext={handleNext} setPaymentData={setPaymentData} paymentData={paymentData} strategy={strategy} />;
      case 2:
        return <Stage1_MethodSelection onNext={handleNext} setPaymentData={setPaymentData} />;
      case 3:
        return <Stage4_Review onNext={handleNext} onBack={handleBack} paymentData={paymentData} onEditStage={handleEditStage} />;
      case 4:
        return <Stage5_FinalPayment onBack={handleBack} paymentData={paymentData} onSuccess={() => setCompleted(true)} />;
      default:
        return null;
    }
  };

  const steps = [
    { number: 1, label: 'Lot Size' },
    { number: 2, label: 'Payment Method' },
    { number: 3, label: 'Review' },
    { number: 4, label: 'Payment' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 py-8 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Main Payment Card */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 sm:p-8">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        stage >= step.number
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {step.number}
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-1 ${
                        stage > step.number ? 'bg-blue-600' : 'bg-gray-100'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Stage Content */}
          <div className="min-h-[400px]">
            {renderStage()}
          </div>

          {/* Cancel Button */}
          {!completed && (
            <div className="mt-8 text-center">
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600 transition-colors text-xs font-medium"
              >
                Cancel setup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PaymentPage = () => {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-900">Loading...</div>}>
      <PaymentContent />
    </Suspense>
  );
};

export default PaymentPage;
