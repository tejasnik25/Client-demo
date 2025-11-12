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
        <CardContent className="space-y-2">
          <p><strong>Strategy Name:</strong> {paymentData.strategyName || 'N/A'}</p>
          <p><strong>Selected Plan:</strong> {paymentData.plan}</p>
          <p><strong>Payment Method:</strong> {paymentData.method}</p>
          <p><strong>MT4/MT5 Account Details:</strong></p>
          <ul className="list-disc list-inside pl-4">
            <li><strong>Account Type:</strong> {paymentData.mt4mt5.type}</li>
            <li><strong>Account ID:</strong> {paymentData.mt4mt5.id}</li>
            <li><strong>Server Address:</strong> {paymentData.mt4mt5.server}</li>
            <li className="flex items-center">
              <strong>Password:</strong>
              <span className="ml-2">
                {showPass ? (paymentData.mt4mt5.password || paymentData.mt4mt5.pass) : '••••••••'}
              </span>
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-600 bg-gray-700 text-white hover:bg-gray-600"
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </li>
          </ul>
          <p><strong>Entered Amount:</strong> ${paymentData.capital}</p>
          <p><strong>Total Amount:</strong> ${paymentData.payable?.toFixed(2)}</p>
          {paymentData.usdToInrRate && (
            <p className="text-xs text-gray-400">Approx ₹{(paymentData.payable * paymentData.usdToInrRate).toFixed(2)} at ₹{paymentData.usdToInrRate} per $1</p>
          )}
          <div className="flex space-x-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => onEditStage && onEditStage(3)}>Edit Account Details</Button>
            <Button type="button" variant="secondary" onClick={() => onEditStage && onEditStage(2)}>Edit Amount</Button>
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
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={handleProceed}>Proceed to Payment</Button>
      </div>
    </div>
  );
};

export default Stage4_Review;