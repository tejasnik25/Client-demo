"use client";

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/label';

interface Stage4Props {
  onNext: () => void;
  onBack: () => void;
  paymentData: any;
  onEditStage?: (stage: number) => void;
}

const Stage4_Review = ({ onNext, onBack, paymentData, onEditStage }: Stage4Props) => {
  const [confirmed, setConfirmed] = useState(false);
  const strategyCurrency = String(paymentData?.strategyCurrency || 'USD').toUpperCase();
  const isUSC = strategyCurrency === 'USC';
  const strategyCapital = Number(paymentData?.capital || 0);
  const walletCharge = Number(paymentData?.payable || 0);

  const formatStrategyAmount = (amount: number) => (
    isUSC ? `USC ${amount.toFixed(2)}` : `$${amount.toFixed(2)}`
  );

  const handleProceed = () => {
    if (!confirmed) {
      alert('Please check the check-box.');
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Review Your Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600 font-medium">Strategy Name:</span>
            <span className="text-gray-900 font-semibold">{paymentData.strategyName || 'N/A'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600 font-medium">Selected Lot Size:</span>
            <span className="text-gray-900 font-semibold">{paymentData.lotLabel || '-'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600 font-medium">Payment Method:</span>
            <span className="text-gray-900 font-semibold">{paymentData.method}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600 font-medium">Strategy Capital:</span>
            <span className="text-gray-900 font-semibold text-lg">{formatStrategyAmount(strategyCapital)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600 font-medium">{isUSC ? 'Wallet Charge:' : 'Total Amount:'}</span>
            <span className="text-gray-900 font-semibold text-lg">${walletCharge.toFixed(2)}</span>
          </div>
          {paymentData.usdToInrRate && (
            <div className="pt-2">
              <p className="text-xs text-gray-600">Approx ₹{(walletCharge * paymentData.usdToInrRate).toFixed(2)} at ₹{paymentData.usdToInrRate} per $1</p>
            </div>
          )}
          <div className="flex space-x-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onEditStage && onEditStage(1)}
              className="border-black text-gray-700 hover:bg-gray-100"
            >
              Edit Lot Size
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onEditStage && onEditStage(2)}
              className="border-black text-gray-700 hover:bg-gray-100"
            >
              Edit Payment Method
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center space-x-2">
        <input
          id="confirm"
          type="checkbox"
          checked={confirmed}
          onChange={() => setConfirmed(!confirmed)}
          className="h-4 w-4"
        />
        <Label htmlFor="confirm">I confirm all above details are correct.</Label>
      </div>
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
          onClick={handleProceed}
          className="bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] text-white"
        >
          Proceed to Payment
        </Button>
      </div>
    </div>
  );
};

export default Stage4_Review;
