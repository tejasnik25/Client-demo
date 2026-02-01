"use client";

import React, { useEffect, useMemo, useState } from 'react';

type Payment = {
  id: string;
  userId: string;
  strategyId: string;
  plan: string;
  capital: number;
  payable: number;
  method: string;
  txId: string;
  proofUrl: string;
  status: string;
  createdAt?: string;
};

const RenewalPendingPage = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => { load(); }, []);

  const pending = useMemo(() => payments.filter(p => p.status === 'renewal_pending'), [payments]);

  const updateStatus = async (paymentId: string, status: 'renewal_approved' | 'rejected') => {
    try {
      const res = await fetch('/api/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, status })
      });
      if (!res.ok) throw new Error('Failed to update payment');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Update failed');
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Renewal - Pending</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Transaction ID</th>
              <th className="p-2">User Name</th>
              <th className="p-2">Strategy</th>
              <th className="p-2">Plan</th>
              <th className="p-2">Payable</th>
              <th className="p-2">Method</th>
              <th className="p-2">Proof</th>
              <th className="p-2">Submitted</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pending.map(p => (
              <tr key={p.id} className="border-b">
                <td className="p-2">{p.txId}</td>
                <td className="p-2">{p.userId}</td>
                <td className="p-2">{p.strategyId}</td>
                <td className="p-2">{p.plan}</td>
                <td className="p-2">{p.payable}</td>
                <td className="p-2">{p.method}</td>
                <td className="p-2"><a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-blue-600">View</a></td>
                <td className="p-2">{p.createdAt ? new Date(p.createdAt).toLocaleString() : '-'}</td>
                <td className="p-2 space-x-2">
                  <button onClick={() => updateStatus(p.id, 'renewal_approved')} className="px-3 py-1 rounded bg-green-600 text-white">Approve</button>
                  <button onClick={() => updateStatus(p.id, 'rejected')} className="px-3 py-1 rounded bg-red-600 text-white">Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RenewalPendingPage;