'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import UserLayout from '@/components/UserLayout';
import { useAuth } from '@/hooks/use-auth';

type PaymentMethod = 'QR' | 'USDT_ERC20' | 'USDT_TRC20';

const WithdrawDetailsContent: React.FC = () => {
  const router = useRouter();
  const params = useSearchParams();
  const methodParam = params.get('method') as PaymentMethod | null;

  const { user } = useAuth();

  const paymentMethod: PaymentMethod = (methodParam || 'QR') as PaymentMethod;

  const [transactionId, setTransactionId] = useState('');
  const [inrAmount, setInrAmount] = useState('');
  const [usdAmount, setUsdAmount] = useState('');
  const [inrToUsdRate, setInrToUsdRate] = useState<number | null>(null);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [rateError, setRateError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Optional but helpful: where the admin should pay out to.
  const [destination, setDestination] = useState('');

  const USDT_ERC20_ADDRESS = process.env.NEXT_PUBLIC_USDT_ERC20_ADDRESS || '';
  const USDT_TRC20_ADDRESS = process.env.NEXT_PUBLIC_USDT_TRC20_ADDRESS || '';

  useEffect(() => {
    if (paymentMethod !== 'QR') {
      setInrToUsdRate(1);
      return;
    }
    const fetchRate = async () => {
      try {
        setRateError('');
        setIsLoadingRate(true);
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/INR');
        const data = await res.json();
        const rate = data?.rates?.USD;
        if (typeof rate === 'number') setInrToUsdRate(rate);
        else throw new Error('Rate not available');
      } catch (err) {
        console.error('Failed to fetch INR→USD rate', err);
        setRateError('Unable to fetch conversion rate. Please try again.');
        setInrToUsdRate(null);
      } finally {
        setIsLoadingRate(false);
      }
    };
    fetchRate();
    const intervalId = setInterval(fetchRate, 60000);
    return () => clearInterval(intervalId);
  }, [paymentMethod]);

  useEffect(() => {
    if (paymentMethod === 'QR' && inrToUsdRate && inrAmount) {
      const inr = parseFloat(inrAmount);
      if (!isNaN(inr) && inr > 0) setUsdAmount((inr * inrToUsdRate).toFixed(2));
      else setUsdAmount('');
    } else if (paymentMethod === 'QR') {
      setUsdAmount('');
    }
  }, [inrAmount, inrToUsdRate, paymentMethod]);

  const renderQR = () => {
    if (paymentMethod === 'USDT_ERC20') {
      return (
        <div className="flex flex-col items-center">
          <Image src="/usdt_erc20-qr.svg" alt="USDT ERC20" width={160} height={160} />
          {USDT_ERC20_ADDRESS && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Address (placeholder): {USDT_ERC20_ADDRESS}</p>
          )}
        </div>
      );
    }
    if (paymentMethod === 'USDT_TRC20') {
      return (
        <div className="flex flex-col items-center">
          <Image src="/usdt_trc20-qr.svg" alt="USDT TRC20" width={160} height={160} />
          {USDT_TRC20_ADDRESS && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Address (placeholder): {USDT_TRC20_ADDRESS}</p>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center">
        <Image src="/upi-qr.svg" alt="UPI" width={160} height={160} />
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Provide your payout UPI/QR ID</p>
      </div>
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transactionId) {
      setError('Please enter the transaction/reference ID');
      return;
    }
    if (!inrAmount || isNaN(parseFloat(inrAmount)) || parseFloat(inrAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (paymentMethod === 'QR') {
      if (!usdAmount || isNaN(parseFloat(usdAmount)) || parseFloat(usdAmount) <= 0) {
        setError('Conversion rate unavailable. Please try again later.');
        return;
      }
    }
    if (!file) {
      setError('Please upload proof for withdrawal request');
      return;
    }
    if (!termsAccepted) {
      setError('You must accept the Terms and Conditions to proceed');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (user) {
        // For withdraw, we store amount in USD value (same convention as topup UI).
        const amountValue = paymentMethod === 'QR' ? parseFloat(usdAmount) : parseFloat(inrAmount);

        const formData = new FormData();
        formData.append('user_id', user.id);
        formData.append('user_name', user.name || '');
        formData.append('user_email', user.email || '');
        formData.append('amount', String(amountValue));
        formData.append('transaction_type', 'charge'); // charge == withdrawal in this codebase
        formData.append('payment_method', paymentMethod);
        formData.append('transaction_id', transactionId);
        if (file) formData.append('receipt', file);
        formData.append('terms_accepted', String(termsAccepted));

        formData.append('inr_amount', String(parseFloat(inrAmount)));
        formData.append('inr_to_usd_rate', String(inrToUsdRate ?? 1));

        formData.append(
          'crypto_network',
          paymentMethod === 'USDT_ERC20' ? 'ERC20' : paymentMethod === 'USDT_TRC20' ? 'TRC20' : ''
        );
        formData.append('crypto_wallet_address', destination || '');
        formData.append('wallet_app_deeplink', '');

        const response = await fetch('/api/wallet/transactions', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Failed to create withdrawal request');
        const transactionResult = await response.json();
        if (transactionResult.success) {
          setSuccess(true);
          const txId = transactionResult.transaction?.id;
          const url = txId ? `/wallet/payment-status?tx=${encodeURIComponent(txId)}` : '/wallet/payment-status';
          setTimeout(() => router.push(url), 1200);
        } else {
          setError('Failed to create withdrawal request. Please try again.');
        }
      }
    } catch (err) {
      console.error('Error processing withdrawal:', err);
      setError('An error occurred while processing your withdrawal request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full px-6 py-6">
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => router.push('/wallet/withdraw?method=USDT_TRC20')}
          className={`px-5 py-3 rounded-2xl font-bold transition-all border ${
            paymentMethod === 'USDT_TRC20'
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
          }`}
        >
          Tether (TRC20)
        </button>
        <button
          type="button"
          onClick={() => router.push('/wallet/withdraw?method=USDT_ERC20')}
          className={`px-5 py-3 rounded-2xl font-bold transition-all border ${
            paymentMethod === 'USDT_ERC20'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
          }`}
        >
          Tether (ERC20)
        </button>
        <button
          type="button"
          onClick={() => router.push('/wallet/withdraw?method=QR')}
          className={`px-5 py-3 rounded-2xl font-bold transition-all border ${
            paymentMethod === 'QR'
              ? 'bg-purple-600 text-white border-purple-600'
              : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
          }`}
        >
          UPI / QR
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#1a1f2e] border border-[#283046] text-white rounded-2xl shadow">
          <div className="px-6 py-5 border-b border-[#283046]">
            <h3 className="text-xl font-semibold">Withdrawal Request</h3>
            <p className="mt-1 text-sm text-gray-300">Submit request and proof. Admin will approve or reject.</p>
          </div>
          <form onSubmit={handleSubmit} className="px-6 py-6">
            <div className="mb-6">{renderQR()}</div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300">
                {paymentMethod.startsWith('USDT') ? 'Amount (USD)' : 'Amount (INR)'}
              </label>
              <input
                type="number"
                className="block w-full sm:text-sm rounded-lg bg-[#0f1527] border border-[#283046] text-white focus:border-[#7c3aed] focus:ring-0 py-3"
                placeholder="0.00"
                value={inrAmount}
                onChange={(e) => setInrAmount(e.target.value)}
                min={paymentMethod.startsWith('USDT') ? '1' : '1'}
                step="0.01"
              />

              {paymentMethod === 'QR' && (
                <>
                  <p className="mt-1 text-sm text-gray-400">USD is calculated automatically in real-time.</p>
                  {isLoadingRate && <p className="mt-1 text-sm text-[#7c3aed]">Fetching latest exchange rate...</p>}
                  {rateError && <p className="mt-1 text-sm text-red-400">{rateError}</p>}
                  {usdAmount && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-300">
                        Est. Amount ($ USD)
                      </label>
                      <input
                        type="number"
                        className="block w-full sm:text-sm rounded-lg bg-[#0f1527] border border-[#283046] text-white focus:border-[#7c3aed] focus:ring-0 py-3"
                        value={usdAmount}
                        readOnly
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mb-6">
              <label htmlFor="transaction-id" className="block text-sm font-medium text-gray-300">Reference / Tx ID</label>
              <input
                type="text"
                id="transaction-id"
                className="block w-full sm:text-sm rounded-lg bg-[#0f1527] border border-[#283046] text-white focus:border-[#7c3aed] focus:ring-0 py-3"
                placeholder="Enter your reference/tx id"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300">
                {paymentMethod === 'QR' ? 'UPI destination (optional)' : 'Destination address (optional)'}
              </label>
              <input
                type="text"
                className="block w-full sm:text-sm rounded-lg bg-[#0f1527] border border-[#283046] text-white focus:border-[#7c3aed] focus:ring-0 py-3"
                placeholder={paymentMethod === 'QR' ? 'e.g. name@upi' : 'TRC20/ERC20 wallet address'}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300">Upload Proof</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-[#283046] border-dashed rounded-lg bg-[#0f1527] cursor-pointer">
                <div className="space-y-1 text-center">
                  {preview ? (
                    <div className="flex flex-col items-center">
                      <Image src={preview} alt="Preview" className="max-h-64 mb-4" width={400} height={300} />
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          setPreview('');
                        }}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Remove image
                      </button>
                    </div>
                  ) : (
                    <>
                      <svg className="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="flex text-sm text-gray-400">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer rounded-md font-medium text-[#7c3aed] hover:text-[#a855f7] focus-within:outline-none"
                        >
                          <span>Upload a file</span>
                          <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="h-4 w-4 text-[#7c3aed] border-[#283046] bg-[#0f1527] rounded"
                />
                <span className="ml-2 text-sm text-gray-300">I accept the Terms and Conditions</span>
              </label>
            </div>

            {error && <div className="mb-4 text-sm text-red-400">{error}</div>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={
                  loading ||
                  isLoadingRate ||
                  !transactionId ||
                  !inrAmount ||
                  isNaN(parseFloat(inrAmount)) ||
                  parseFloat(inrAmount) <= 0 ||
                  (paymentMethod === 'QR' && (!usdAmount || isNaN(parseFloat(usdAmount)) || parseFloat(usdAmount) <= 0)) ||
                  !file ||
                  !termsAccepted
                }
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg shadow-sm text-white ${
                  loading ||
                  isLoadingRate ||
                  !transactionId ||
                  !inrAmount ||
                  isNaN(parseFloat(inrAmount)) ||
                  parseFloat(inrAmount) <= 0 ||
                  (paymentMethod === 'QR' && (!usdAmount || isNaN(parseFloat(usdAmount)) || parseFloat(usdAmount) <= 0)) ||
                  !file ||
                  !termsAccepted
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:from-[#6d28d9] hover:to-[#9333ea]'
                }`}
              >
                {loading ? 'Processing...' : 'Submit Withdrawal'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-[#161d31] border border-[#283046] text-white rounded-2xl shadow p-6">
          <h4 className="text-lg font-semibold mb-4">Request Summary</h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Method</span><span className="font-bold">{paymentMethod.replace('_', ' ')}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Amount</span><span className="font-bold">{paymentMethod.startsWith('USDT') ? `$${inrAmount || '0.00'}` : `₹${inrAmount || '0.00'}`}</span></div>
            {paymentMethod === 'QR' && usdAmount && (
              <div className="flex justify-between"><span className="text-gray-400">Est. USD</span><span className="text-green-400 font-bold">${usdAmount}</span></div>
            )}
          </div>
          <p className="mt-4 text-xs text-gray-400 italic">Withdrawals are processed manually by our finance team.</p>
        </div>
      </div>
    </div>
  );
};

const WithdrawPageInner: React.FC = () => {
  return (
    <UserLayout>
      <WithdrawDetailsContent />
    </UserLayout>
  );
};

export default function WithdrawPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading withdrawal...</div>}>
      <WithdrawPageInner />
    </Suspense>
  );
}

