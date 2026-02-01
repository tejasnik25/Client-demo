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
  approvedAt?: string;
  verifiedBy?: string;
};

const ApprovedTransactionsPage = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/payments');
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

  const approved = useMemo(() => payments.filter(p => p.status === 'approved'), [payments]);

  const exportCsv = () => {
    const headers = ['Transaction ID','User Name','Strategy','Plan','Entered Amount','Paid Amount','Payment Method','Approved On','Verified By'];
    const rows = approved.map(p => [p.txId, p.userId, p.strategyId, p.plan, p.capital, p.payable, p.method, p.approvedAt ?? '', p.verifiedBy ?? '']);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'approved-transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Approved Transactions</h1>
        <button onClick={exportCsv} className="px-3 py-2 rounded bg-blue-600 text-white">Export CSV</button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Transaction ID</th>
              <th className="p-2">User Name</th>
              <th className="p-2">Strategy</th>
              <th className="p-2">Plan</th>
              <th className="p-2">Entered Amount</th>
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
                <td className="p-2">{p.capital}</td>
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

export default ApprovedTransactionsPage;