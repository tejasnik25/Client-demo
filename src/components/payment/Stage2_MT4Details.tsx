"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { PaymentData } from '@/types';

const schema = z.object({
  type: z.enum(['MT4', 'MT5']),
  id: z.string().min(1, 'MT4/MT5 ID is required'),
  pass: z.string().min(1, 'Password is required'),
  server: z.string().min(1, 'Server is required'),
});

type FormData = z.infer<typeof schema>;

interface Stage2Props {
  onNext: () => void;
  onBack: () => void;
  setPaymentData: (data: any) => void;
  paymentData?: PaymentData | null;
}

const Stage2_MT4Details = ({ onNext, onBack, setPaymentData, paymentData }: Stage2Props) => {
  const { register, handleSubmit, formState: { errors }, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: paymentData?.mt4mt5
      ? {
          type: (paymentData.mt4mt5 as any).type,
          id: (paymentData.mt4mt5 as any).id,
          pass: (paymentData.mt4mt5 as any).password || (paymentData.mt4mt5 as any).pass,
          server: (paymentData.mt4mt5 as any).server,
        }
      : undefined,
  });

  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (paymentData?.mt4mt5) {
      setValue('type', (paymentData.mt4mt5 as any).type);
      setValue('id', (paymentData.mt4mt5 as any).id);
      setValue('pass', (paymentData.mt4mt5 as any).password || (paymentData.mt4mt5 as any).pass);
      setValue('server', (paymentData.mt4mt5 as any).server);
    }
  }, [paymentData, setValue]);

  const onSubmit = (data: FormData) => {
    setPaymentData((prev: any) => ({ ...prev, mt4mt5: { ...data, password: data.pass } }));
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label>Type</Label>
        <Select onValueChange={(value) => setValue('type', value as 'MT4' | 'MT5')} defaultValue={(paymentData?.mt4mt5 as any)?.type}>
          <SelectTrigger className="bg-gray-700 text-white border border-gray-600">
            <SelectValue placeholder="Select MT4 or MT5" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 text-white border border-gray-700">
            <SelectItem value="MT4">MT4</SelectItem>
            <SelectItem value="MT5">MT5</SelectItem>
          </SelectContent>
        </Select>
        {errors.type && <p className="text-red-500 text-sm">{errors.type.message}</p>}
      </div>
      <div>
        <Label htmlFor="id">MT4/MT5 ID</Label>
        <Input id="id" {...register('id')} />
        {errors.id && <p className="text-red-500 text-sm">{errors.id.message}</p>}
      </div>
      <div>
        <Label htmlFor="pass">Password</Label>
        <div className="relative">
          <Input id="pass" type={showPass ? 'text' : 'password'} {...register('pass')} className="pr-12" />
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-md border border-gray-600 bg-gray-700 text-white hover:bg-gray-600"
            aria-label={showPass ? 'Hide password' : 'Show password'}
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.pass && <p className="text-red-500 text-sm">{errors.pass.message}</p>}
      </div>
      <div>
        <Label htmlFor="server">Server</Label>
        <Input id="server" {...register('server')} />
        {errors.server && <p className="text-red-500 text-sm">{errors.server.message}</p>}
      </div>
      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button type="submit">Next</Button>
      </div>
    </form>
  );
};

export default Stage2_MT4Details;