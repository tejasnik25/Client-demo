'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import UserLayout from '@/components/UserLayout';
import { useAuth } from '@/hooks/use-auth';

const TopupDetailsContent: React.FC = () => {
  const router = useRouter();
  const params = useSearchParams();
  const methodParam = params.get('method') as 'QR' | 'USDT_ERC20' | 'USDT_TRC20' | null;
  const strategyIdParam = params.get('strategyId');
  const planParam = params.get('plan'); // 'premium' | 'expert' | 'pro'
  const amountParam = params.get('amount');
  const { user } = useAuth();

  const [transactionId, setTransactionId] = useState('');
  const [inrAmount, setInrAmount] = useState('');
  const [usdAmount, setUsdAmount] = useState('');
  const [inrToUsdRate, setInrToUsdRate] = useState<number | null>(null);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [rateError, setRateError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [platform, setPlatform] = useState<'MT4' | 'MT5' | null>(null);
  const [mtAccountId, setMtAccountId] = useState('');
  const [mtAccountPassword, setMtAccountPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const USDT_ERC20_ADDRESS = process.env.NEXT_PUBLIC_USDT_ERC20_ADDRESS || '';
  const USDT_TRC20_ADDRESS = process.env.NEXT_PUBLIC_USDT_TRC20_ADDRESS || '';
  const WALLET_APP_DEEPLINK = process.env.NEXT_PUBLIC_USDT_WALLET_APP_LINK || '';

  const paymentMethod = useMemo(() => methodParam, [methodParam]);
  const isStrategyPurchase = !!strategyIdParam;

  // Prefill amount and lock editing if provided via query
  useEffect(() => {
    if (amountParam) {
      setInrAmount(amountParam);
    }
  }, [amountParam]);

  useEffect(() => {
    // Only fetch for non-crypto methods or if USD is needed
    if (paymentMethod !== 'QR') {
      // Default rate for USDT is 1:1, but we can still fetch for display
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
        if (typeof rate === 'number') {
          setInrToUsdRate(rate);
        } else {
          throw new Error('Rate not available');
        }
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
      if (!isNaN(inr) && inr > 0) {
        setUsdAmount((inr * inrToUsdRate).toFixed(2));
      } else {
        setUsdAmount('');
      }
    } else if (paymentMethod === 'QR') {
      setUsdAmount('');
    }
  }, [inrAmount, inrToUsdRate, paymentMethod]);

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

    if (!paymentMethod) {
      setError('No payment method selected');
      return;
    }
    if (!transactionId) {
      setError('Please enter the transaction ID');
      return;
    }
    if (!inrAmount || isNaN(parseFloat(inrAmount)) || parseFloat(inrAmount) <= 0) {
      setError('Please enter a valid INR amount');
      return;
    }
    if (paymentMethod === 'QR') {
      if (!usdAmount || isNaN(parseFloat(usdAmount)) || parseFloat(usdAmount) <= 0) {
        setError('Conversion rate unavailable. Please try again later.');
        return;
      }
    }
    if (!file) {
      setError('Please upload a payment receipt');
      return;
    }
    if (isStrategyPurchase) {
      if (!platform) {
        setError('Please select a platform (MT4 or MT5)');
        return;
      }
      if (!mtAccountId) {
        setError('Please enter your MT account ID');
        return;
      }
      if (!mtAccountPassword) {
        setError('Please enter your MT account password');
        return;
      }
    }
    if (!termsAccepted) {
      setError('You must accept the Terms and Conditions to proceed');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (user) {
        // For USDT, amount is already in USD. For QR (UPI), it might be INR.
        const amountValue = paymentMethod === 'QR' ? parseFloat(usdAmount) : parseFloat(inrAmount);
        
        const formData = new FormData();
        formData.append('user_id', user.id);
        formData.append('user_name', user.name || '');
        formData.append('user_email', user.email || '');
        formData.append('amount', String(amountValue));
        formData.append('transaction_type', 'deposit');
        formData.append('payment_method', paymentMethod);
        formData.append('transaction_id', transactionId);
        if (file) formData.append('receipt', file);
        formData.append('terms_accepted', String(termsAccepted));

        // Only collect master/slave MT credentials if user is paying for a strategy
        if (isStrategyPurchase) {
          formData.append('platform', platform as string);
          formData.append('mt_account_id', mtAccountId);
          formData.append('mt_account_password', mtAccountPassword);
          if (strategyIdParam) formData.append('strategy_id', strategyIdParam);
          if (planParam) formData.append('plan_level', planParam.toUpperCase());
        }

        formData.append('inr_amount', String(parseFloat(inrAmount)));
        formData.append('inr_to_usd_rate', String(inrToUsdRate ?? 1));
        formData.append(
          'crypto_network',
          paymentMethod === 'USDT_ERC20' ? 'ERC20' : paymentMethod === 'USDT_TRC20' ? 'TRC20' : ''
        );
        formData.append(
          'crypto_wallet_address',
          paymentMethod === 'USDT_ERC20'
            ? USDT_ERC20_ADDRESS
            : paymentMethod === 'USDT_TRC20'
            ? USDT_TRC20_ADDRESS
            : ''
        );
        formData.append(
          'wallet_app_deeplink',
          paymentMethod?.startsWith('USDT') ? WALLET_APP_DEEPLINK : ''
        );

        const response = await fetch('/api/wallet/transactions', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Failed to create transaction');
        const transactionResult = await response.json();
        if (transactionResult.success) {
          setSuccess(true);
          const txId = transactionResult.transaction?.id;
          const url = txId ? `/wallet/payment-status?tx=${encodeURIComponent(txId)}` : '/wallet/payment-status';
          setTimeout(() => router.push(url), 1200);
        } else {
          setError('Failed to create transaction. Please try again.');
        }
      }
    } catch (err) {
      console.error('Error processing payment:', err);
      setError('An error occurred while processing your payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderQR = () => {
    if (paymentMethod === 'USDT_ERC20') {
      return (
        <div className="flex flex-col items-center">
          <Image src="/usdt_erc20-qr.svg" alt="USDT ERC20 QR" width={160} height={160} />
          {USDT_ERC20_ADDRESS && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Address: {USDT_ERC20_ADDRESS}</p>
          )}
        </div>
      );
    }
    if (paymentMethod === 'USDT_TRC20') {
      return (
        <div className="flex flex-col items-center">
          <Image src="/usdt_trc20-qr.svg" alt="USDT TRC20 QR" width={160} height={160} />
          {USDT_TRC20_ADDRESS && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Address: {USDT_TRC20_ADDRESS}</p>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center">
        <Image src="/upi-qr.svg" alt="QR Payment" width={160} height={160} />
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Scan to pay via UPI</p>
      </div>
    );
  };

  return (
    <div className="w-full px-6 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Payment Details */}
        <div className="lg:col-span-2 bg-[#1a1f2e] border border-[#283046] text-white rounded-2xl shadow">
          <div className="px-6 py-5 border-b border-[#283046]">
            <h3 className="text-xl font-semibold">Top-up Details</h3>
            <p className="mt-1 text-sm text-gray-300">Complete your payment and submit the request.</p>
          </div>
          <form onSubmit={handleSubmit} className="px-6 py-6">
            {/* QR Display */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300">Payment QR</label>
              <div className="mt-2">{renderQR()}</div>
              {WALLET_APP_DEEPLINK && paymentMethod && paymentMethod.startsWith('USDT') && (
                <a href={WALLET_APP_DEEPLINK} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[#7c3aed] hover:text-[#a855f7] text-sm">
                  Open wallet app
                </a>
              )}
            </div>

            {/* User ID */}
            <div className="mb-6">
              <label htmlFor="user-id" className="block text-sm font-medium text-gray-300">User ID</label>
              <input
                type="text"
                id="user-id"
                className="block w-full sm:text-sm rounded-lg bg-[#0f1527] border border-[#283046] text-white focus:border-[#7c3aed] focus:ring-0 py-3"
                value={user?.id || ''}
                disabled
              />
            </div>

            {/* Amount INR and USD */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300">
                {paymentMethod?.startsWith('USDT') ? 'Amount ($ USD)' : 'Amount (₹ INR)'}
              </label>
              <input
                type="number"
                className="block w-full sm:text-sm rounded-lg bg-[#0f1527] border border-[#283046] text-white focus:border-[#7c3aed] focus:ring-0 py-3"
                placeholder="0.00"
                value={inrAmount}
                onChange={(e) => setInrAmount(e.target.value)}
                min={paymentMethod?.startsWith('USDT') ? "50" : "1"}
                step="0.01"
                disabled={!!amountParam}
              />
              {paymentMethod?.startsWith('USDT') && (
                <p className="mt-1 text-xs text-amber-400 font-medium">Minimum deposit is $50.00 USD</p>
              )}
              {paymentMethod === 'QR' && (
                <>
                  <p className="mt-1 text-sm text-gray-400">USD is calculated automatically in real-time.</p>
                  {isLoadingRate && <p className="mt-1 text-sm text-[#7c3aed]">Fetching latest exchange rate...</p>}
                  {rateError && <p className="mt-1 text-sm text-red-400">{rateError}</p>}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-300">
                      Equivalent Amount ($ USD) {inrToUsdRate && <span className="text-xs text-gray-500">@ {inrToUsdRate.toFixed(6)} USD/INR</span>}
                    </label>
                    <input
                      type="number"
                      className="block w-full sm:text-sm rounded-lg bg-[#0f1527] border border-[#283046] text-white focus:border-[#7c3aed] focus:ring-0 py-3"
                      value={usdAmount}
                      readOnly
                    />
                  </div>
                </>
              )}
            </div>

            {/* Transaction ID */}
            <div className="mb-6">
              <label htmlFor="transaction-id" className="block text-sm font-medium text-gray-300">Transaction ID</label>
              <input
                type="text"
                id="transaction-id"
                className="block w-full sm:text-sm rounded-lg bg-[#0f1527] border border-[#283046] text-white focus:border-[#7c3aed] focus:ring-0 py-3"
                placeholder="Enter the transaction ID from your payment"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
              />
            </div>

            {/* Upload Receipt */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300">Upload Payment Receipt</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-[#283046] border-dashed rounded-lg bg-[#0f1527] cursor-pointer">
                <div className="space-y-1 text-center">
                  {preview ? (
                    <div className="flex flex-col items-center">
                      <Image src={preview} alt="Preview" className="max-h-64 mb-4" width={400} height={300} />
                      <button type="button" onClick={() => { setFile(null); setPreview(''); }} className="text-sm text-red-400 hover:text-red-300">Remove image</button>
                    </div>
                  ) : (
                    <>
                      <svg className="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="flex text-sm text-gray-400">
                        <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-[#7c3aed] hover:text-[#a855f7] focus-within:outline-none">
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

            {isStrategyPurchase && (
              <>
                {/* Platform selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300">Trading Platform</label>
                  <div className="mt-2 flex items-center space-x-6">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="platform"
                        value="MT4"
                        checked={platform === 'MT4'}
                        onChange={() => setPlatform('MT4')}
                        className="h-4 w-4 text-[#7c3aed] focus:ring-0 border-[#283046] bg-[#0f1527] cursor-pointer"
                      />
                      <span className="ml-2 text-sm text-gray-300">MT4</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="platform"
                        value="MT5"
                        checked={platform === 'MT5'}
                        onChange={() => setPlatform('MT5')}
                        className="h-4 w-4 text-[#7c3aed] focus:ring-0 border-[#283046] bg-[#0f1527] cursor-pointer"
                      />
                      <span className="ml-2 text-sm text-gray-300">MT5</span>
                    </label>
                  </div>
                </div>

                {/* MT account details */}
                <div className="mb-6">
                  <label htmlFor="mt-account-id" className="block text-sm font-medium text-gray-300">MT4/MT5 Account ID</label>
                  <input
                    type="text"
                    id="mt-account-id"
                    className="block w-full sm:text-sm rounded-lg bg-[#0f1527] border border-[#283046] text-white focus:border-[#7c3aed] focus:ring-0 py-3"
                    placeholder="Enter your MT account ID"
                    value={mtAccountId}
                    onChange={(e) => setMtAccountId(e.target.value)}
                  />
                </div>
                <div className="mb-6">
                  <label htmlFor="mt-account-password" className="block text-sm font-medium text-gray-300">MT4/MT5 Account Password</label>
                  <input
                    type="password"
                    id="mt-account-password"
                    className="block w-full sm:text-sm rounded-lg bg-[#0f1527] border border-[#283046] text-white focus:border-[#7c3aed] focus:ring-0 py-3"
                    placeholder="Enter your MT account password"
                    value={mtAccountPassword}
                    onChange={(e) => setMtAccountPassword(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Terms */}
            <div className="mb-6">
              <label className="inline-flex items-center">
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="h-4 w-4 text-[#7c3aed] border-[#283046] bg-[#0f1527] rounded" />
                <span className="ml-2 text-sm text-gray-300">I accept the Terms and Conditions</span>
              </label>
            </div>

            {/* Error */}
            {error && <div className="mb-4 text-sm text-red-400">{error}</div>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={
                  loading ||
                  !paymentMethod ||
                  !transactionId ||
                  !inrAmount ||
                  (paymentMethod === 'QR' && !usdAmount) ||
                  !file ||
                  !termsAccepted ||
                  (isStrategyPurchase && (!platform || !mtAccountId || !mtAccountPassword))
                }
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg shadow-sm text-white ${
                  loading ||
                  !paymentMethod ||
                  !transactionId ||
                  !inrAmount ||
                  (paymentMethod === 'QR' && !usdAmount) ||
                  !file ||
                  !termsAccepted ||
                  (isStrategyPurchase && (!platform || !mtAccountId || !mtAccountPassword))
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:from-[#6d28d9] hover:to-[#9333ea]'
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  'Submit Payment'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Order Summary */}
        <div className="bg-[#161d31] border border-[#283046] text-white rounded-2xl shadow p-6">
          <h4 className="text-lg font-semibold mb-4">Order Summary</h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Method</span><span className="font-bold">{paymentMethod?.replace('_', ' ') || '—'}</span></div>
            <div className="flex justify-between">
              <span className="text-gray-400">Amount</span>
              <span className="font-bold">
                {paymentMethod?.startsWith('USDT') ? `$${inrAmount || '0.00'}` : `₹${inrAmount || '0.00'}`}
              </span>
            </div>
            {paymentMethod === 'QR' && usdAmount && (
              <div className="flex justify-between">
                <span className="text-gray-400">Est. USD</span>
                <span className="text-green-400 font-bold">${usdAmount}</span>
              </div>
            )}
            <div className="flex justify-between"><span className="text-gray-400">Fee</span><span>0.00</span></div>
            <div className="flex justify-between font-semibold border-t border-[#283046] pt-3">
              <span>Total</span>
              <span className="text-lg text-blue-400">
                {paymentMethod?.startsWith('USDT') ? `$${inrAmount || '0.00'}` : `₹${inrAmount || '0.00'}`}
              </span>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-400 italic">Payments are processed manually by our finance team for your security.</p>
        </div>
      </div>
    </div>
  );
};

const TopupPageInner: React.FC = () => {
  return (
    <UserLayout>
      <TopupDetailsContent />
    </UserLayout>
  );
};

const TopupPage: React.FC = () => {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading topup...</div>}>
      <TopupPageInner />
    </Suspense>
  );
};

export default TopupPage;
