'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import  Button  from '@/components/ui/Button';
import UserLayout from '@/components/UserLayout';
import { useEffect } from 'react';

const PaymentMethodInner = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const strategyId = searchParams.get('strategyId');
  const plan = searchParams.get('plan');
  const amount = searchParams.get('amount');

  // Redirect if missing required parameters
  useEffect(() => {
    if (!strategyId || !plan || !amount) {
      router.push('/strategies');
    }
  }, [strategyId, plan, amount, router]);

  const handleMethodSelect = (method: 'USDT_ERC20' | 'USDT_TRC20' | 'QR') => {
    router.push(`/wallet/topup?strategyId=${encodeURIComponent(strategyId || '')}&plan=${encodeURIComponent(plan || '')}&amount=${encodeURIComponent(amount || '')}&method=${method}`);
  };

  return (
    <UserLayout>
      <div className="min-h-screen bg-[#0f1527] text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Payment</h1>
            {/* <p className="text-sm text-gray-400">Add funds to your wallet to continue using stock analysis features</p> */}
          </div>

          <div className="bg-[#1a1f2e] rounded-xl p-6 border border-[#283046]">
            <h2 className="text-xl font-semibold mb-4">Select a Payment Method</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* USDT ERC20 */}
              <div className="bg-[#161d31] border border-[#283046] rounded-xl p-6 hover:border-[#7367f0]/50 transition-all">
                <div className="text-lg font-medium mb-2">USDT (ERC 20)</div>
                <p className="text-sm text-gray-400 mb-4">Pay with USDT on Ethereum network</p>
                <div className="flex justify-center mb-4">
                  <div className="w-32 h-32 bg-white/10 rounded-lg flex items-center justify-center">
                    <img src="/usdt_erc20-qr.svg" alt="USDT ERC20 QR" className="w-24 h-24" />
                  </div>
                </div>
                <Button 
                  className="w-full bg-[#7367f0] hover:bg-[#6a5ce6]"
                  onClick={() => handleMethodSelect('USDT_ERC20')}
                >
                  Proceed
                </Button>
              </div>

              {/* USDT TRC20 */}
              <div className="bg-[#161d31] border border-[#283046] rounded-xl p-6 hover:border-[#7367f0]/50 transition-all">
                <div className="text-lg font-medium mb-2">USDT (TRC 20)</div>
                <p className="text-sm text-gray-400 mb-4">Pay with USDT on TRON network</p>
                <div className="flex justify-center mb-4">
                  <div className="w-32 h-32 bg-white/10 rounded-lg flex items-center justify-center">
                    <img src="/usdt_trc20-qr.svg" alt="USDT TRC20 QR" className="w-24 h-24" />
                  </div>
                </div>
                <Button 
                  className="w-full bg-[#7367f0] hover:bg-[#6a5ce6]"
                  onClick={() => handleMethodSelect('USDT_TRC20')}
                >
                  Proceed
                </Button>
              </div>

              {/* QR Code */}
              <div className="bg-[#161d31] border border-[#283046] rounded-xl p-6 hover:border-[#7367f0]/50 transition-all">
                <div className="text-lg font-medium mb-2">UPI Payment</div>
                <p className="text-sm text-gray-400 mb-4">Scan and pay via QR</p>
                <div className="flex justify-center mb-4">
                  <div className="w-32 h-32 bg-white/10 rounded-lg flex items-center justify-center">
                    <img src="/upi-qr.svg" alt="QR Payment" className="w-24 h-24" />
                  </div>
                </div>
                <Button 
                  className="w-full bg-[#7367f0] hover:bg-[#6a5ce6]"
                  onClick={() => handleMethodSelect('QR')}
                >
                  Proceed
                </Button>
              </div>
            </div>

            <div className="mt-6 text-sm text-gray-400">
              <p>Choose a payment method to proceed with your {plan} plan purchase.</p>
              <p className="mt-2">Amount: ₹{amount}</p>
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
};

export default function PaymentMethodPage() {
  // Wrap useSearchParams usage in Suspense per Next.js guidance
  return (
    <Suspense>
      <PaymentMethodInner />
    </Suspense>
  );
}