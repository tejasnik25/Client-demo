"use client";

import React, { useState, useEffect } from 'react';

interface PlanUsage {
  id: number;
  userId: string;
  strategyId: string;
  plan: string;
  capital: number;
  payable: number;
  status: string;
}

const PlanUsagePage = () => {
  const [planUsage, setPlanUsage] = useState<PlanUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlanUsage = async () => {
      try {
        const response = await fetch('/api/plan-usage');
        if (!response.ok) {
          throw new Error('Failed to fetch plan usage data');
        }
        const data = await response.json();
        setPlanUsage(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchPlanUsage();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Plan Usage Report</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">User ID</th>
              <th className="py-2 px-4 border-b">Strategy ID</th>
              <th className="py-2 px-4 border-b">Plan</th>
              <th className="py-2 px-4 border-b">Capital</th>
              <th className="py-2 px-4 border-b">Payable</th>
              <th className="py-2 px-4 border-b">Status</th>
            </tr>
          </thead>
          <tbody>
            {planUsage.map((item) => (
              <tr key={item.id}>
                <td className="py-2 px-4 border-b">{item.userId}</td>
                <td className="py-2 px-4 border-b">{item.strategyId}</td>
                <td className="py-2 px-4 border-b">{item.plan}</td>
                <td className="py-2 px-4 border-b">{item.capital}</td>
                <td className="py-2 px-4 border-b">{item.payable}</td>
                <td className="py-2 px-4 border-b">{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlanUsagePage;