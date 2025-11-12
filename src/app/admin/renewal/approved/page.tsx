"use client";

import React, { useEffect, useMemo, useState } from 'react';

type Payment = {
  id: string;
  userId: string;
  strategyId: string;
  plan: string;
  payable: number;
  method: string;
  txId: string;
  status: string;
  approvedAt?: string;
  verifiedBy?: string;
};

const RenewalApprovedPage = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/payments?renewal=true');
        if (!res.ok) throw new Error('Failed to load payments');
        const data = await res.json();
        setPayments(Array.isArray(data) ? data : (data.payments ?? []));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const approved = useMemo(() => payments.filter(p => p.status === 'renewal_approved'), [payments]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Renewal - Approved</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Transaction ID</th>
              <th className="p-2">User Name</th>
              <th className="p-2">Strategy</th>
              <th className="p-2">Plan</th>
              <th className="p-2">Paid Amount</th>
              <th className="p-2">Payment Method</th>
              <th className="p-2">Approved On</th>
              <th className="p-2">Verified By</th>
            </tr>
          </thead>
          <tbody>
            {approved.map(p => (
              <tr key={p.id} className="border-b">
                <td className="p-2">{p.txId}</td>
                <td className="p-2">{p.userId}</td>
                <td className="p-2">{p.strategyId}</td>
                <td className="p-2">{p.plan}</td>
                <td className="p-2">{p.payable}</td>
                <td className="p-2">{p.method}</td>
                <td className="p-2">{p.approvedAt ? new Date(p.approvedAt).toLocaleString() : '-'}</td>
                <td className="p-2">{p.verifiedBy ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RenewalApprovedPage;