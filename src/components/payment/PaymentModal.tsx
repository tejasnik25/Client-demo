"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePaymentStore } from '@/hooks/usePaymentStore';
import Stage1_MethodSelection from './Stage1_MethodSelection';
import Stage2_MT4Details from './Stage2_MT4Details';
import Stage3_CapitalInput from './Stage3_CapitalInput';
import Stage4_Review from './Stage4_Review';
import Stage5_FinalPayment from './Stage5_FinalPayment';
import Timer from './Timer';
import { PaymentData } from '@/types';

const PaymentModal = () => {
  const { stage, setStage, reset } = usePaymentStore();
  const [isOpen, setIsOpen] = useState(true);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);

  const handleClose = () => {
    setIsOpen(false);
    reset();
  };

  const handleNext = () => {
    if (stage < 5) {
      setStage(stage + 1);
    }
  };

  const handleBack = () => {
    if (stage > 1) {
      setStage(stage - 1);
    }
  };

  const handleTimeout = () => {
    reset();
    setIsOpen(false);
  };

  const renderStage = () => {
    switch (stage) {
      case 1:
        return (
          <Stage1_MethodSelection
            onNext={handleNext}
            setPaymentData={setPaymentData}
          />
        );
      case 2:
        return (
          <Stage3_CapitalInput
            onNext={handleNext}
            onBack={handleBack}
            setPaymentData={setPaymentData}
            paymentData={paymentData}
          />
        );
      case 3:
        return (
          <Stage2_MT4Details
            onNext={handleNext}
            onBack={handleBack}
            setPaymentData={setPaymentData as any}
            paymentData={paymentData}
          />
        );
      case 4:
        return (
          <Stage4_Review
            onNext={handleNext}
            onBack={handleBack}
            paymentData={paymentData}
            onEditStage={setStage}
          />
        );
      case 5:
        return (
          <Stage5_FinalPayment
            onBack={handleBack}
            paymentData={paymentData}
            onSuccess={handleClose}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Your Payment</DialogTitle>
          <Timer onTimeout={handleTimeout} />
        </DialogHeader>
        {renderStage()}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
