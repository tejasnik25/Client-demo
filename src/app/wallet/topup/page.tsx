'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import UserLayout from '@/components/UserLayout';
import { useAuth } from '@/hooks/use-auth';

const TopupDetailsContent: React.FC = () => {
  const router = useRouter();
  const params = useSearchParams();
  const methodParam = params.get('method') as 'QR' | 'USDT_ERC20' | 'USDT_TRC20' | null;
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

  useEffect(() => {
    if (paymentMethod !== 'QR') return;

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
    if (!termsAccepted) {
      setError('You must accept the Terms and Conditions to proceed');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (user) {
        const amountValue = paymentMethod === 'QR' ? parseFloat(usdAmount) : parseFloat(inrAmount);
        const response = await fetch('/api/wallet/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            amount: amountValue,
            transaction_type: 'deposit',
            payment_method: paymentMethod,
            transaction_id: transactionId,
            receipt_path: file ? file.name : null,
            platform,
            mt_account_id: mtAccountId,
            mt_account_password: mtAccountPassword,
            terms_accepted: termsAccepted,
            status: 'pending',
            inr_amount: parseFloat(inrAmount),
            inr_to_usd_rate: inrToUsdRate,
            crypto_network: paymentMethod === 'USDT_ERC20' ? 'ERC20' : paymentMethod === 'USDT_TRC20' ? 'TRC20' : null,
            crypto_wallet_address: paymentMethod === 'USDT_ERC20' ? USDT_ERC20_ADDRESS : paymentMethod === 'USDT_TRC20' ? USDT_TRC20_ADDRESS : null,
            wallet_app_deeplink: paymentMethod?.startsWith('USDT') ? WALLET_APP_DEEPLINK : null,
          }),
        });

        if (!response.ok) throw new Error('Failed to create transaction');
        const transactionResult = await response.json();
        if (transactionResult.success) {
          setSuccess(true);
          setTimeout(() => router.push('/dashboard'), 2000);
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
    <div className="container mx-auto py-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Top-up Details</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Complete your payment and submit the request.
          </p>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="px-4 py-5 sm:p-6">
            {/* QR Display */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment QR</label>
              <div className="mt-2">{renderQR()}</div>
              {WALLET_APP_DEEPLINK && paymentMethod && paymentMethod.startsWith('USDT') && (
                <a href={WALLET_APP_DEEPLINK} target="_blank" rel="noreferrer" className="mt-2 inline-block text-blue-600 dark:text-blue-400 text-sm">
                  Open wallet app
                </a>
              )}
            </div>

            {/* User ID */}
            <div className="mb-6">
              <label htmlFor="user-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">User ID</label>
              <input
                type="text"
                id="user-id"
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md"
                value={user?.id || ''}
                disabled
              />
            </div>

            {/* Amount INR and USD */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount (₹ INR)</label>
              <input
                type="number"
                className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md"
                placeholder="0.00"
                value={inrAmount}
                onChange={(e) => setInrAmount(e.target.value)}
                min="1"
                step="0.01"
              />
              {paymentMethod === 'QR' && (
                <>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">USD is calculated automatically in real-time.</p>
                  {isLoadingRate && <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">Fetching latest exchange rate...</p>}
                  {rateError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{rateError}</p>}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Equivalent Amount ($ USD) {inrToUsdRate && <span className="text-xs text-gray-500">@ {inrToUsdRate.toFixed(6)} USD/INR</span>}
                    </label>
                    <input
                      type="number"
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md"
                      value={usdAmount}
                      readOnly
                    />
                  </div>
                </>
              )}
            </div>

            {/* Transaction ID */}
            <div className="mb-6">
              <label htmlFor="transaction-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Transaction ID</label>
              <input
                type="text"
                id="transaction-id"
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md"
                placeholder="Enter the transaction ID from your payment"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
              />
            </div>

            {/* Upload Receipt */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Upload Payment Receipt</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-700 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {preview ? (
                    <div className="flex flex-col items-center">
                      <Image src={preview} alt="Preview" className="max-h-64 mb-4" width={400} height={300} />
                      <button type="button" onClick={() => { setFile(null); setPreview(''); }} className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">Remove image</button>
                    </div>
                  ) : (
                    <>
                      <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="flex text-sm text-gray-600 dark:text-gray-400">
                        <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 focus-within:outline-none">
                          <span>Upload a file</span>
                          <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, GIF up to 10MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Platform selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Trading Platform</label>
              <div className="mt-2 flex items-center space-x-6">
                <label className="inline-flex items-center">
                  <input type="radio" name="platform" value="MT4" checked={platform === 'MT4'} onChange={() => setPlatform('MT4')} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">MT4</span>
                </label>
                <label className="inline-flex items-center">
                  <input type="radio" name="platform" value="MT5" checked={platform === 'MT5'} onChange={() => setPlatform('MT5')} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">MT5</span>
                </label>
              </div>
            </div>

            {/* MT account details */}
            <div className="mb-6">
              <label htmlFor="mt-account-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">MT4/MT5 Account ID</label>
              <input type="text" id="mt-account-id" className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md" placeholder="Enter your MT account ID" value={mtAccountId} onChange={(e) => setMtAccountId(e.target.value)} />
            </div>
            <div className="mb-6">
              <label htmlFor="mt-account-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">MT4/MT5 Account Password</label>
              <input type="password" id="mt-account-password" className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md" placeholder="Enter your MT account password" value={mtAccountPassword} onChange={(e) => setMtAccountPassword(e.target.value)} />
            </div>

            {/* Terms */}
            <div className="mb-6">
              <label className="inline-flex items-center">
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">I accept the Terms and Conditions</span>
              </label>
            </div>

            {/* Error */}
            {error && <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>}

            <div className="flex justify-end">
              <button type="submit" disabled={loading || !paymentMethod || !transactionId || !inrAmount || (paymentMethod === 'QR' && !usdAmount) || !file || !platform || !mtAccountId || !mtAccountPassword || !termsAccepted} className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${loading || !paymentMethod || !transactionId || !inrAmount || (paymentMethod === 'QR' && !usdAmount) || !file || !platform || !mtAccountId || !mtAccountPassword || !termsAccepted ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
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
      </div>
    </div>
  );
};

const TopupPage: React.FC = () => {
  return (
    <UserLayout>
      <TopupDetailsContent />
    </UserLayout>
  );
};

export default TopupPage;