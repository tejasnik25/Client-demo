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

const PaymentModal = () => {
  const { stage, setStage, reset } = usePaymentStore();
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
    reset();
  };

  const renderStage = () => {
    switch (stage) {
      case 1:
        return <Stage1_MethodSelection />;
      case 2:
        return <Stage2_MT4Details />;
      case 3:
        return <Stage3_CapitalInput />;
      case 4:
        return <Stage4_Review />;
      case 5:
        return <Stage5_FinalPayment />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Your Payment</DialogTitle>
          <Timer />
        </DialogHeader>
        {renderStage()}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;