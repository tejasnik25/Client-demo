'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';
const USDT_ERC20_ADDRESS = process.env.NEXT_PUBLIC_USDT_ERC20_ADDRESS || '';
const USDT_TRC20_ADDRESS = process.env.NEXT_PUBLIC_USDT_TRC20_ADDRESS || '';
const UPI_ID = (process.env.NEXT_PUBLIC_UPI_ID || '').trim();
const WALLET_APP_DEEPLINK = process.env.NEXT_PUBLIC_USDT_WALLET_APP_LINK || '';
const DEFAULT_USD_TO_INR = parseFloat(process.env.NEXT_PUBLIC_USD_TO_INR_RATE || '83');

const schema = z.object({
  txId: z.string().min(1, 'Transaction ID is required'),
  proof: z.any().refine(files => files?.length === 1, 'Proof of payment is required.'),
});

type FormData = z.infer<typeof schema>;

interface Stage5Props {
  onBack: () => void;
  paymentData: any;
  onSuccess?: () => void;
}

const Stage5_FinalPayment = ({ onBack, paymentData, onSuccess }: Stage5Props) => {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const [successTxId, setSuccessTxId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const inrRate = useMemo(() => paymentData?.usdToInrRate || DEFAULT_USD_TO_INR, [paymentData]);
  const inrAmount = useMemo(() => (paymentData?.payable || 0) * inrRate, [paymentData, inrRate]);

  const getQR = () => {
    switch (paymentData.method) {
      case 'USDT_ERC20':
        return '/usdt_erc20-qr.svg';
      case 'USDT_TRC20':
        return '/usdt_trc20-qr.svg';
      case 'UPI':
        return '/upi-qr.svg';
      default:
        return '';
    }
  };

  const onSubmit = async (data: FormData) => {
    let transactionId: string | null = null;
    try {
      setLoading(true);
      // Create payment transaction with appropriate status (renewal_pending for renewals, pending for new)
      const status = paymentData?.isRenewal ? 'renewal_pending' : 'pending';
      const createRes = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...paymentData, 
          status,
          isRenewal: paymentData?.isRenewal || false,
          runningStrategyId: paymentData?.runningStrategyId,
        }),
      });

      if (!createRes.ok) throw new Error('Failed to create payment transaction');

      const created = await createRes.json();
      transactionId = created.transactionId;
      if (!transactionId) throw new Error('Missing transaction ID');

      const file = data.proof[0];
      const fileType = file?.type || 'image/png';

      // 1. Try to get signed URL; if not available, fall back locally
      let proofUrl = '';
      try {
        const signedUrlRes = await fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileType, transactionId }),
        });
        if (signedUrlRes.ok) {
          const { signedUrl, key, useLocalFallback } = await signedUrlRes.json();
          if (!useLocalFallback && signedUrl && key) {
            // 2. Upload file to S3
            await fetch(signedUrl, {
              method: 'PUT',
              body: file,
              headers: { 'Content-Type': fileType },
            });
            const awsRegion = process.env.NEXT_PUBLIC_AWS_REGION || process.env.AWS_REGION || 'ap-south-1';
            proofUrl = `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET}.s3.${awsRegion}.amazonaws.com/${key}`;
          }
        }
      } catch (e) {
        // Ignore and use fallback proof URL
      }

      if (!proofUrl) {
        // No S3 configured or upload failed: record a placeholder proof URL that always resolves
        proofUrl = 'https://via.placeholder.com/200x200?text=No+Proof';
      }

      // 3. Update payment with proof and txId
      // For renewals, status should be renewal_pending, otherwise in-process
      const updateStatus = paymentData?.isRenewal ? 'renewal_pending' : 'in-process';
      const updateRes = await fetch(`/api/payments/${transactionId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            txId: data.txId, 
            proofUrl, 
            status: updateStatus,
            isRenewal: paymentData?.isRenewal || false,
            runningStrategyId: paymentData?.runningStrategyId,
          }),
        }
      );
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        throw new Error(`Failed to update payment: ${errText}`);
      }

      setSuccessTxId(transactionId);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error(error);
      alert('Payment submission failed.');
      // Mark the transaction as failed when possible
      try {
        if (transactionId) {
          await fetch(`/api/payments/${transactionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'failed' }),
          });
        }
      } catch (e) {
        // Swallow error to avoid breaking UX
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className={`flex flex-col items-center ${successTxId ? 'opacity-30 pointer-events-none select-none blur-[1px]' : ''}`}>
        <div className="p-4 bg-white rounded-xl mb-6">
          <Image src={getQR()} alt={`${paymentData.method} QR Code`} width={180} height={180} />
        </div>
        
        {paymentData.method && paymentData.method.startsWith('USDT') ? (
          <div className="w-full space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
            {/* Network Info */}
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
              <span className="text-gray-600">Network</span>
              <span className="font-semibold text-gray-900">
                {paymentData.method === 'USDT_ERC20' ? 'Ethereum (ERC20)' : 'TRON (TRC20)'}
              </span>
            </div>

            {/* Amount Info */}
            <div className="space-y-1">
              <span className="text-gray-600 text-sm">Total Amount</span>
              <div className="flex items-center gap-2 bg-white p-2 rounded border border-gray-300">
                <span className="font-mono text-lg flex-1 text-green-600">${paymentData.payable?.toFixed(2)}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(paymentData.payable?.toFixed(2) || '', 'amount')}
                  className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-600 hover:text-gray-900"
                  title="Copy Amount"
                >
                  {copied === 'amount' ? <FiCheck className="text-green-600" /> : <FiCopy />}
                </button>
              </div>
            </div>

            {/* Address Info */}
            <div className="space-y-1">
              <span className="text-gray-600 text-sm">Wallet Address</span>
              <div className="flex items-center gap-2 bg-white p-2 rounded border border-gray-300">
                <span className="font-mono text-xs sm:text-sm break-all flex-1 text-gray-700">
                  {paymentData.method === 'USDT_ERC20' ? USDT_ERC20_ADDRESS : USDT_TRC20_ADDRESS}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(paymentData.method === 'USDT_ERC20' ? USDT_ERC20_ADDRESS : USDT_TRC20_ADDRESS, 'address')}
                  className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-600 hover:text-gray-900 flex-shrink-0"
                  title="Copy Address"
                >
                  {copied === 'address' ? <FiCheck className="text-green-600" /> : <FiCopy />}
                </button>
              </div>
            </div>

            {WALLET_APP_DEEPLINK && (
               <a href={WALLET_APP_DEEPLINK} target="_blank" rel="noreferrer" className="block text-center text-[#00d09c] hover:text-[#00b085] text-sm mt-2">
                 Open in Wallet App
               </a>
            )}
          </div>
        ) : (
          /* Non-USDT View (UPI, etc.) */
          <div className="w-full space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
             <div className="flex justify-between border-b border-gray-200 pb-2">
               <span className="text-gray-600">Amount (USD)</span>
               <span className="font-bold text-gray-900">${paymentData.payable?.toFixed(2)}</span>
             </div>
             <div className="flex justify-between border-b border-gray-200 pb-2">
               <span className="text-gray-600">Exchange Rate</span>
               <span className="text-gray-900">₹{inrRate.toFixed(2)} / $1</span>
             </div>
             <div className="flex justify-between pt-2 pb-2 border-b border-gray-200">
               <span className="text-gray-600">Total (INR)</span>
               <span className="font-bold text-xl text-green-600">₹{inrAmount.toFixed(2)}</span>
             </div>
             
             {paymentData.method === 'UPI' && UPI_ID && (
               <div className="space-y-1 pt-2">
                 <span className="text-gray-600 text-sm">UPI ID</span>
                 <div className="flex items-center gap-2 bg-white p-2 rounded border border-black">
                   <input
                     type="text"
                     value={UPI_ID}
                     readOnly
                     className="font-mono text-sm flex-1 text-gray-900 bg-transparent outline-none border-none w-full min-w-0 cursor-text"
                     onClick={(e) => e.currentTarget.select()}
                   />
                   <button
                     type="button"
                     onClick={() => handleCopy(UPI_ID, 'upi')}
                     className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-600 hover:text-gray-900 flex-shrink-0"
                     title="Copy UPI ID"
                   >
                     {copied === 'upi' ? <FiCheck className="text-green-600" /> : <FiCopy />}
                   </button>
                 </div>
                 <p className="mt-2 text-xs text-gray-600">Scan the QR code or use the UPI ID above to make payment.</p>
               </div>
             )}
             
             {paymentData.method === 'UPI' && !UPI_ID && (
               <p className="mt-4 text-xs text-gray-600">Scan the QR to open your UPI app with prefilled details.</p>
             )}
          </div>
        )}
      </div>
      {!successTxId && (
      <div>
        <Label htmlFor="txId">Transaction ID</Label>
        <Input id="txId" {...register('txId')} />
        {errors.txId && <p className="text-red-500 text-sm">{errors.txId.message}</p>}
      </div>
      )}
      {!successTxId && (
      <div>
        <Label htmlFor="proof">Proof of Payment (JPG/PNG, &lt;5MB)</Label>
        <Input id="proof" type="file" accept=".jpg,.jpeg,.png" {...register('proof')} />
        {errors.proof && <p className="text-red-500 text-sm">{errors.proof.message as string}</p>}
      </div>
      )}
      {!successTxId ? (
        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="border-black text-gray-700 hover:bg-gray-100"
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : 'Submit Payment'}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-green-600 bg-green-50 p-4 text-center">
          <p className="font-semibold text-gray-900">Payment completed successfully!</p>
          <p className="mt-1 text-sm text-gray-700">Your Transaction ID: <span className="font-mono text-gray-900">{successTxId}</span></p>
          <div className="mt-3 flex justify-center space-x-2">
            <Button
              type="button"
              onClick={() => router.push('/strategies/running')}
              className="bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] text-white"
            >
              Go to Running Strategies
            </Button>
          </div>
        </div>
      )}
    </form>
  );
};

export default Stage5_FinalPayment;