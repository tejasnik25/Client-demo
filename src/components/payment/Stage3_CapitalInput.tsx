"use client";

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import type { PaymentData } from '@/types';

// Default USD→INR conversion rate via env
const DEFAULT_USD_TO_INR = parseFloat(process.env.NEXT_PUBLIC_USD_TO_INR_RATE || '83');

// Plan ranges and percents (can be refined to read from strategy if needed)
const PLAN_RANGES: Record<string, { min: number; max?: number; percent: number; label: string }> = {
  Pro: { min: 1000, max: 2999, percent: 17, label: '$1000-$2999' },
  Expert: { min: 3000, max: 5999, percent: 15, label: '$3000-$5999' },
  Premium: { min: 6000, max: undefined, percent: 12, label: '$6000+' },
};

type FormData = { capital: number };

interface Stage3Props {
  onNext: () => void;
  onBack: () => void;
  setPaymentData: React.Dispatch<React.SetStateAction<PaymentData | null>>;
  paymentData: PaymentData | null;
}

const Stage3_CapitalInput = ({ onNext, onBack, setPaymentData, paymentData }: Stage3Props) => {
  const selectedPlan = (paymentData?.plan as keyof typeof PLAN_RANGES) || 'Pro';
  const range = PLAN_RANGES[selectedPlan];

  // Build schema dynamically per selected plan
  const schema = useMemo(() => {
    const minMsg = `Please enter the amount between ${range.label}`;
    const zmin = z.coerce.number().min(range.min, minMsg);
    const zmax = range.max ? zmin.max(range.max, minMsg) : zmin;
    return z.object({ capital: zmax });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan]);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema as any),
    defaultValues: {
      capital: paymentData?.capital ?? undefined as any,
    },
  });

  const [rate, setRate] = useState<number>(paymentData?.usdToInrRate ?? DEFAULT_USD_TO_INR);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await fetch('/api/rate', { cache: 'no-store' });
        const data = await res.json();
        const liveRate = data?.rate;
        if (isMounted && typeof liveRate === 'number' && liveRate > 0) {
          setRate(liveRate);
        }
      } catch (e) {
        // Fallback to default; no action needed
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const capital = watch('capital');

  const payable = useMemo(() => {
    const pct = range.percent;
    return capital && capital >= range.min && (!range.max || capital <= range.max)
      ? (capital * pct) / 100
      : 0;
  }, [capital, range]);

  const onSubmit = (data: FormData) => {
    // Only proceed if within range
    if (data.capital >= range.min && (!range.max || data.capital <= range.max)) {
      setPaymentData(prev => ({
        ...(prev || {}),
        capital: data.capital,
        plan: selectedPlan,
        payable,
        usdToInrRate: rate || DEFAULT_USD_TO_INR,
      } as PaymentData));
      onNext();
    }
  };

  const inrAmount = payable > 0 ? payable * (rate || DEFAULT_USD_TO_INR) : 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="capital">Enter your Account Capital</Label>
        <Input
          id="capital"
          type="number"
          min={range.min}
          {...(range.max ? { max: range.max } : {})}
          {...register('capital')}
        />
        <p className="text-xs text-gray-400 mt-1">Allowed for {selectedPlan}: {range.label}</p>
        {errors.capital && (
          <p className="text-red-500 text-sm">{String((errors.capital as any).message || `Please enter the amount between ${range.label}`)}</p>
        )}
      </div>

      <div>
        <Label>Selected Plan</Label>
        <Input value={selectedPlan} readOnly />
      </div>

      <div>
        <Label>Total Amount</Label>
        <Input value={`$${payable.toFixed(2)}`} readOnly />
        {payable > 0 && (
          <p className="text-xs text-gray-400 mt-1">Approx ₹{inrAmount.toFixed(2)} at ₹{(rate || DEFAULT_USD_TO_INR)} per $1</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Note: INR conversion shown here is indicative to help users.</p>
      </div>

      {/* Exchange rate field removed; using real-time market rate when available */}

      {/* Optional helper: show wallet info if method is USDT */}
      {paymentData?.method?.startsWith('USDT') ? (
        <div className="rounded-lg border border-[#283046] p-3 text-sm">
          <p className="text-gray-300">You selected {paymentData?.method}. Use the wallet address shown on the next step.</p>
          {process.env.NEXT_PUBLIC_USDT_WALLET_APP_LINK && (
            <a href={process.env.NEXT_PUBLIC_USDT_WALLET_APP_LINK} className="text-[#7c3aed] hover:text-[#a855f7]" target="_blank" rel="noreferrer">Open wallet app</a>
          )}
        </div>
      ) : null}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="submit" disabled={payable <= 0}>Next</Button>
      </div>
    </form>
  );
};

export default Stage3_CapitalInput;