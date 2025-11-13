'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import Timer from '@/components/payment/Timer';
import Stage1_MethodSelection from '@/components/payment/Stage1_MethodSelection';
import Stage2_MT4Details from '@/components/payment/Stage2_MT4Details';
import Stage3_CapitalInput from '@/components/payment/Stage3_CapitalInput';
import Stage4_Review from '@/components/payment/Stage4_Review';
import Stage5_FinalPayment from '@/components/payment/Stage5_FinalPayment';
import { PaymentData } from '@/types';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const PaymentContent = () => {
  const [stage, setStage] = useState(1);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [completed, setCompleted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const strategyId = searchParams.get('strategy') ?? searchParams.get('strategyId');
    const plan = searchParams.get('plan');

    if (strategyId && plan) {
      // Fetch strategy name from API
      fetch(`/api/strategies/${strategyId}`)
        .then(res => res.json())
        .then(strategy => {
          setPaymentData((prevData: PaymentData | null) => ({
            ...(prevData ?? {}),
            strategyId,
            plan,
            strategyName: strategy?.name ?? '',
          } as PaymentData));
        })
        .catch(() => {
          // Even if strategy fetch fails, keep the provided params
          setPaymentData((prevData: PaymentData | null) => ({
            ...(prevData ?? {}),
            strategyId,
            plan,
          } as PaymentData));
        });
    }
  }, [searchParams]);

  const handleNext = () => setStage(stage + 1);
  const handleBack = () => setStage(stage - 1);
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
        return <Stage1_MethodSelection onNext={handleNext} setPaymentData={setPaymentData} />;
      case 2:
        return <Stage3_CapitalInput onNext={handleNext} onBack={handleBack} setPaymentData={setPaymentData} paymentData={paymentData} />;
      case 3:
        return <Stage2_MT4Details onNext={handleNext} onBack={handleBack} setPaymentData={setPaymentData} paymentData={paymentData} />;
      case 4:
        return <Stage4_Review onNext={handleNext} onBack={handleBack} paymentData={paymentData} onEditStage={handleEditStage} />;
      case 5:
        return <Stage5_FinalPayment onBack={handleBack} paymentData={paymentData} onSuccess={() => setCompleted(true)} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl mx-auto bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8 relative">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Complete Your Payment</h1>
            <p className="text-gray-400 mt-1">Securely finish your transaction.</p>
          </div>
          <Timer onTimeout={handleTimeout} />
        </div>

        {renderStage()}

        {!completed && (
          <div className="mt-8 text-center">
            <button onClick={handleCancel} className="text-gray-400 hover:text-white transition-colors">
              Cancel Payment
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const PaymentPage = () => {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading...</div>}>
      <PaymentContent />
    </Suspense>
  );
};

export default PaymentPage;