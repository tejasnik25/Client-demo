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
const USDT_ERC20_ADDRESS = process.env.NEXT_PUBLIC_USDT_ERC20_ADDRESS || '';
const USDT_TRC20_ADDRESS = process.env.NEXT_PUBLIC_USDT_TRC20_ADDRESS || '';
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
      // Create payment transaction with pending status
      const createRes = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...paymentData, status: 'pending' }),
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
      const updateRes = await fetch(`/api/payments/${transactionId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txId: data.txId, proofUrl, status: 'in-process' }),
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
        <Image src={getQR()} alt={`${paymentData.method} QR Code`} width={200} height={200} />
        <p className="mt-2"><strong>Amount:</strong> ${paymentData.payable?.toFixed(2)}</p>
        {!(paymentData.method && paymentData.method.startsWith('USDT')) && (
          <>
            <p className=""><strong>Exchange Rate:</strong> ₹{inrRate.toFixed(2)} per $1</p>
            <p className=""><strong>Amount in INR:</strong> ₹{inrAmount.toFixed(2)}</p>
          </>
        )}
        <p><strong>Plan:</strong> {paymentData.plan}</p>
        {paymentData.method === 'USDT_ERC20' && USDT_ERC20_ADDRESS && (
          <p className="mt-2 text-xs text-gray-300">Address: {USDT_ERC20_ADDRESS}</p>
        )}
        {paymentData.method === 'USDT_TRC20' && USDT_TRC20_ADDRESS && (
          <p className="mt-2 text-xs text-gray-300">Address: {USDT_TRC20_ADDRESS}</p>
        )}
        {WALLET_APP_DEEPLINK && paymentData.method && paymentData.method.startsWith('USDT') && (
          <a href={WALLET_APP_DEEPLINK} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[#7c3aed] hover:text-[#a855f7] text-sm">
            Open wallet app
          </a>
        )}
        {paymentData.method === 'UPI' && (
          <p className="mt-2 text-xs text-gray-400">Scan the QR to open your UPI app with prefilled details.</p>
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
          <Button type="button" variant="outline" onClick={onBack}>Back</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Payment'}</Button>
        </div>
      ) : (
        <div className="rounded-lg border border-green-600 bg-green-900/30 p-4 text-center">
          <p className="font-semibold">Payment completed successfully!</p>
          <p className="mt-1 text-sm">Your Transaction ID: <span className="font-mono">{successTxId}</span></p>
          <div className="mt-3 flex justify-center space-x-2">
            <Button type="button" onClick={() => router.push('/running-strategies')}>Go to Running Strategies</Button>
          </div>
        </div>
      )}
    </form>
  );
};

export default Stage5_FinalPayment;