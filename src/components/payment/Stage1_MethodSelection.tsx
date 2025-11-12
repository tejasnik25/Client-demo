"use client";

import Button from '@/components/ui/Button';
import { FaEthereum } from 'react-icons/fa';
import { SiTether } from 'react-icons/si';
import { FaRupeeSign } from 'react-icons/fa';

import { PaymentData } from '@/types';

interface Stage1Props {
  onNext: () => void;
  setPaymentData: React.Dispatch<React.SetStateAction<PaymentData | null>>;
}

const Stage1_MethodSelection = ({ onNext, setPaymentData }: Stage1Props) => {
  const handleSelect = (method: string) => {
    setPaymentData((prev) => ({ ...prev, method } as PaymentData));
    onNext();
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Select Payment Method</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button variant="outline" onClick={() => handleSelect('USDT_ERC20')} className="flex flex-col h-24">
          <FaEthereum className="text-4xl mb-2" />
          <span>USDT (ERC20)</span>
        </Button>
        <Button variant="outline" onClick={() => handleSelect('USDT_TRC20')} className="flex flex-col h-24">
          <SiTether className="text-4xl mb-2" />
          <span>USDT (TRC20)</span>
        </Button>
        <Button variant="outline" onClick={() => handleSelect('UPI')} className="flex flex-col h-24">
          <FaRupeeSign className="text-4xl mb-2" />
          <span>UPI</span>
        </Button>
      </div>
    </div>
  );
};

export default Stage1_MethodSelection;