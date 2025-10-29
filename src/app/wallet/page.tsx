'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import Image from 'next/image';
import UserLayout from '@/components/UserLayout';
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

const WalletPageContent: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<'QR' | 'USDT_ERC20' | 'USDT_TRC20' | null>(null);
  const [transactionId, setTransactionId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [showQRCode, setShowQRCode] = useState<boolean>(false);
  const [platform, setPlatform] = useState<'MT4' | 'MT5' | null>(null);
  const [mtAccountId, setMtAccountId] = useState<string>('');
  const [mtAccountPassword, setMtAccountPassword] = useState<string>('');
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [step, setStep] = useState<'select-payment' | 'payment-details'>(
    'select-payment'
  );
  // INR/USD conversion state and env-configured USDT details
  const [inrAmount, setInrAmount] = useState<string>('');
  const [usdAmount, setUsdAmount] = useState<string>('');
  const [inrToUsdRate, setInrToUsdRate] = useState<number | null>(null);
  const [rateError, setRateError] = useState<string>('');
  const [isLoadingRate, setIsLoadingRate] = useState<boolean>(false);
  const USDT_ERC20_ADDRESS = process.env.NEXT_PUBLIC_USDT_ERC20_ADDRESS || '';
  const USDT_TRC20_ADDRESS = process.env.NEXT_PUBLIC_USDT_TRC20_ADDRESS || '';
  const WALLET_APP_DEEPLINK = process.env.NEXT_PUBLIC_USDT_WALLET_APP_LINK || '';

  useEffect(() => {
    if (paymentMethod !== 'QR') return;
    
    const fetchRate = async () => {
      try {
        setRateError('');
        setIsLoadingRate(true);
        // Using a more reliable API for real-time exchange rates
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
    
    // Set up interval for real-time updates (every 60 seconds)
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
      
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handlePaymentMethodSelect = (method: 'QR' | 'USDT_ERC20' | 'USDT_TRC20') => {
    router.push(`/wallet/topup?method=${method}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentMethod) {
      setError('Please select a payment method');
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

    if (!usdAmount || isNaN(parseFloat(usdAmount)) || parseFloat(usdAmount) <= 0) {
      setError('Conversion rate unavailable. Please try again later.');
      return;
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
        const amountValue = parseFloat(usdAmount);
        
        // Create transaction via API
        const response = await fetch('/api/wallet/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            user_name: user.name,
            user_email: user.email,
            amount: amountValue,
            transaction_type: 'deposit',
            payment_method: paymentMethod,
            transaction_id: transactionId,
            receipt_path: file ? file.name : null, // Use filename as placeholder; avoid large base64 strings
            platform: platform,
            mt_account_id: mtAccountId,
            mt_account_password: mtAccountPassword,
            terms_accepted: termsAccepted,
            status: 'pending',
            inr_amount: inrAmount ? parseFloat(inrAmount) : null,
            inr_to_usd_rate: inrToUsdRate,
            crypto_network: paymentMethod === 'USDT_ERC20' ? 'ERC20' : paymentMethod === 'USDT_TRC20' ? 'TRC20' : null,
            crypto_wallet_address: paymentMethod === 'USDT_ERC20' ? USDT_ERC20_ADDRESS : paymentMethod === 'USDT_TRC20' ? USDT_TRC20_ADDRESS : null,
            wallet_app_deeplink: paymentMethod?.startsWith('USDT') ? WALLET_APP_DEEPLINK : null,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create transaction');
        }

        const transactionResult = await response.json();
        
        if (transactionResult.success) {
          // Show success message
          setSuccess(true);
          
          // Redirect to dashboard after a delay
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        } else {
          setError('Failed to create transaction. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      setError('An error occurred while processing your payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="w-full py-6 space-y-6">
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Wallet Top-up
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Add funds to your wallet to continue using stock analysis features.
            </p>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="px-4 py-5 sm:p-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select a Payment Method</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle>USDT (ERC 20)</CardTitle>
                    <CardDescription>Pay with USDT on Ethereum network</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center">
                    <img src="/usdt_erc20-qr.svg" alt="USDT ERC20 QR" className="mt-3 w-32 h-32 object-contain opacity-60" />
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" onClick={() => router.push('/wallet/topup?method=USDT_ERC20')}>Proceed</Button>
                  </CardFooter>
                </Card>
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle>USDT (TRC 20)</CardTitle>
                    <CardDescription>Pay with USDT on TRON network</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center">
                    <img src="/usdt_trc20-qr.svg" alt="USDT TRC20 QR" className="mt-3 w-32 h-32 object-contain opacity-60" />
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" onClick={() => router.push('/wallet/topup?method=USDT_TRC20')}>Proceed</Button>
                  </CardFooter>
                </Card>
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle>QR Code Payment</CardTitle>
                    <CardDescription>Scan and pay via QR</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center">
                    <img src="/upi-qr.svg" alt="QR Payment" className="mt-3 w-32 h-32 object-contain opacity-60" />
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" onClick={() => router.push('/wallet/topup?method=QR')}>Proceed</Button>
                  </CardFooter>
                </Card>
              </div>
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Choose a method to proceed.</p>
            </div>
          </div>
        </div>
    </div>
  );
};

// Main page with UserLayout wrapper
const WalletPage: React.FC = () => {
  return (
    <UserLayout>
      <WalletPageContent />
    </UserLayout>
  );
};

export default WalletPage;