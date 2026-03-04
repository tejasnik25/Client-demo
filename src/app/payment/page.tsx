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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Strategy Card - Similar to Reference Design */}
        {strategy && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start gap-4">
              {/* Profile Picture/Icon */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00d09c] to-[#00b085] flex items-center justify-center flex-shrink-0">
                {strategy.imageUrl ? (
                  <Image
                    src={strategy.imageUrl}
                    alt={strategy.name}
                    width={64}
                    height={64}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white text-2xl font-bold">
                    {strategy.name?.charAt(0)?.toUpperCase() || 'S'}
                  </span>
                )}
              </div>

              {/* Strategy Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold text-gray-900">{strategy.name || 'Strategy'}</h2>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                    Master
                  </span>
                </div>

                {/* Lot Size Summary */}
                <div className="grid grid-cols-1 gap-2 mt-4">
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-600">Copy proportion</p>
                    <p className="text-sm font-semibold text-gray-900">{paymentData?.lotSize ?? '-' }{paymentData?.lotSize ? `×${paymentData.lotSize}` : ''}</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-600">Required Investment</p>
                    <p className="text-sm font-semibold text-gray-900">{typeof paymentData?.payable === 'number' ? `$${paymentData.payable.toFixed(2)}` : '-'}</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="text-sm font-semibold text-gray-900">{typeof paymentData?.payable === 'number' ? `$${paymentData.payable.toFixed(2)}` : '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Payment Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
          {/* Progress Bar - Similar to Reference */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                        stage >= step.number
                          ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white shadow-md'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {step.number}
                    </div>
                    <span
                      className={`text-xs mt-2 text-center ${
                        stage >= step.number ? 'text-[#00d09c] font-semibold' : 'text-gray-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 ${
                        stage > step.number ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085]' : 'bg-gray-200'
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
                className="text-gray-600 hover:text-gray-900 transition-colors text-sm"
              >
                Cancel Payment
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
