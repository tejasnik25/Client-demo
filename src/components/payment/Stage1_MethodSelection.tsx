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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Payment Method</h2>
        <p className="text-gray-600">Choose your preferred payment method</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => handleSelect('USDT_ERC20')}
          className="flex flex-col items-center justify-center h-32 p-4 border-2 border-gray-200 rounded-xl hover:border-[#00d09c] hover:bg-green-50 transition-all bg-white"
        >
          <FaEthereum className="text-4xl mb-2 text-gray-700" />
          <span className="text-gray-900 font-medium">USDT (ERC20)</span>
        </button>
        <button
          onClick={() => handleSelect('USDT_TRC20')}
          className="flex flex-col items-center justify-center h-32 p-4 border-2 border-gray-200 rounded-xl hover:border-[#00d09c] hover:bg-green-50 transition-all bg-white"
        >
          <SiTether className="text-4xl mb-2 text-gray-700" />
          <span className="text-gray-900 font-medium">USDT (TRC20)</span>
        </button>
        <button
          onClick={() => handleSelect('UPI')}
          className="flex flex-col items-center justify-center h-32 p-4 border-2 border-gray-200 rounded-xl hover:border-[#00d09c] hover:bg-green-50 transition-all bg-white"
        >
          <FaRupeeSign className="text-4xl mb-2 text-gray-700" />
          <span className="text-gray-900 font-medium">UPI</span>
        </button>
      </div>
    </div>
  );
};

export default Stage1_MethodSelection;