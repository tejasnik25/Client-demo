'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
  const [showPass, setShowPass] = useState(false);

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
            <span className="text-gray-600 font-medium">Selected Plan:</span>
            <span className="text-gray-900 font-semibold">{paymentData.plan}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600 font-medium">Payment Method:</span>
            <span className="text-gray-900 font-semibold">{paymentData.method}</span>
          </div>
          <div className="py-2 border-b border-gray-200">
            <p className="text-gray-600 font-medium mb-2">MT4/MT5 Account Details:</p>
            <ul className="space-y-2 pl-4">
              <li className="flex justify-between">
                <span className="text-gray-600">Account Type:</span>
                <span className="text-gray-900 font-medium">{paymentData.mt4mt5.type}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600">Account ID:</span>
                <span className="text-gray-900 font-medium">{paymentData.mt4mt5.id}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-600">Server Address:</span>
                <span className="text-gray-900 font-medium">{paymentData.mt4mt5.server}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-gray-600">Password:</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-900 font-mono">
                    {showPass ? (paymentData.mt4mt5.password || paymentData.mt4mt5.pass) : '••••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black bg-white text-gray-700 hover:bg-gray-100 transition-colors"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </li>
            </ul>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600 font-medium">Entered Amount:</span>
            <span className="text-gray-900 font-semibold">${paymentData.capital}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600 font-medium">Total Amount:</span>
            <span className="text-gray-900 font-semibold text-lg">${paymentData.payable?.toFixed(2)}</span>
          </div>
          {paymentData.usdToInrRate && (
            <div className="pt-2">
              <p className="text-xs text-gray-600">Approx ₹{(paymentData.payable * paymentData.usdToInrRate).toFixed(2)} at ₹{paymentData.usdToInrRate} per $1</p>
            </div>
          )}
          <div className="flex space-x-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onEditStage && onEditStage(4)}
              className="border-black text-gray-700 hover:bg-gray-100"
            >
              Edit Account Details
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onEditStage && onEditStage(3)}
              className="border-black text-gray-700 hover:bg-gray-100"
            >
              Edit Amount
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
