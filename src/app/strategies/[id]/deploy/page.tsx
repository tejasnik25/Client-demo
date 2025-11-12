"use client";
import React from 'react';
import { useRouter } from 'next/navigation';

const plans = [
  { id: 'basic', name: 'Basic', price: '$100' },
  { id: 'standard', name: 'Standard', price: '$200' },
  { id: 'pro', name: 'Pro', price: '$300' },
];

const PlanSelectionPage = () => {
  const router = useRouter();

  const handleSelectPlan = (planId: string) => {
    router.push(`/payment?plan=${planId}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Select a Plan</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map(plan => (
          <div key={plan.id} className="border rounded-lg p-6 text-center">
            <h2 className="text-2xl font-semibold mb-4">{plan.name}</h2>
            <p className="text-xl mb-4">{plan.price}</p>
            <button 
              onClick={() => handleSelectPlan(plan.id)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Select
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlanSelectionPage;