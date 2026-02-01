"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';

type Payment = {
  id: string;
  userId: string;
  userName?: string;
  email?: string;
  strategyId: string;
  strategyName?: string;
  plan: string;
  capital?: number;
  payable: number;
  method: string;
  txId: string;
  status: string;
  createdAt?: string;
  approvedAt?: string;
};

const NewStrategyPage = () => {
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [planFilter, setPlanFilter] = useState<string>('');

  const load = async () => {
    try {
      const res = await fetch('/api/payments');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load payments');
      const allPayments = Array.isArray(data.payments) ? data.payments : [];
      
      // Filter only new strategies (not renewal)
      const newStrategyPayments = allPayments
        .filter((p: any) => !p.status?.includes('renewal'))
        .map((p: any) => ({
          id: p.id,
          userId: p.user_id || p.userId,
          userName: p.user?.name,
          email: p.user?.email,
          strategyId: p.strategy_id || p.strategyId,
          strategyName: p.strategy?.name,
          plan: p.plan_level || p.plan,
          capital: p.capital,
          payable: p.amount || p.payable,
          method: p.payment_method || p.method,
          txId: p.transaction_id || p.txId,
          status: p.status,
          createdAt: p.created_at || p.createdAt,
          approvedAt: p.updated_at || p.approvedAt,
        }));
      
      setRows(newStrategyPayments);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch = 
        !searchTerm || 
        r.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.strategyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.txId || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = !statusFilter || r.status === statusFilter;
      const matchesPlan = !planFilter || r.plan === planFilter;
      
      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [rows, searchTerm, statusFilter, planFilter]);

  const exportCSV = () => {
    const header = [
      "User ID",
      "User Name",
      "Email",
      "Strategy Name",
      "Plan",
      "Capital",
      "Payable",
      "Method",
      "TX ID",
      "Status",
      "Created At",
      "Approved At"
    ];
    const csv = [header.join(",")]
      .concat(
        filteredRows.map((r) => {
          return [
            r.userId || '',
            r.userName || '',
            r.email || '',
            r.strategyName || '',
            r.plan || '',
            r.capital || 0,
            r.payable || 0,
            r.method || '',
            r.txId || '',
            r.status || '',
            r.createdAt ? new Date(r.createdAt).toISOString() : '',
            r.approvedAt ? new Date(r.approvedAt).toISOString() : ''
          ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
        })
      ).join("\n");
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "new-strategies.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">New Strategy</h1>
        <Link href="/admin/plan-usage" className="text-sm px-3 py-2 rounded bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
          Back to Plan Usage
        </Link>
      </div>

      {/* Filters and Export */}
      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium mb-1 text-gray-700">Search</label>
          <input
            type="text"
            placeholder="Search by User, Strategy, or TX ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white border border-gray-200 text-gray-900"
          />
        </div>
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium mb-1 text-gray-700">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white border border-gray-200 text-gray-900"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-400">
        Showing {filteredRows.length} of {rows.length} new strategies
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b text-gray-900">User Name</th>
              <th className="py-2 px-4 border-b text-gray-900">Strategy</th>
              <th className="py-2 px-4 border-b text-gray-900">Plan</th>
              <th className="py-2 px-4 border-b text-gray-900">Capital</th>
              <th className="py-2 px-4 border-b text-gray-900">Payable</th>
              <th className="py-2 px-4 border-b text-gray-900">Method</th>
              <th className="py-2 px-4 border-b text-gray-900">TX ID</th>
              <th className="py-2 px-4 border-b">Status</th>
              <th className="py-2 px-4 border-b">Created At</th>
              <th className="py-2 px-4 border-b">Approved At</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-4 text-center text-gray-400">
                  No new strategies found
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 px-4 border-b">
                    <div className="font-medium">{r.userName || r.userId}</div>
                    <div className="text-xs text-gray-500">{r.email}</div>
                  </td>
                  <td className="py-2 px-4 border-b">{r.strategyName}</td>
                  <td className="py-2 px-4 border-b">{r.plan}</td>
                  <td className="py-2 px-4 border-b">{r.capital}</td>
                  <td className="py-2 px-4 border-b">{r.payable}</td>
                  <td className="py-2 px-4 border-b">{r.method}</td>
                  <td className="py-2 px-4 border-b font-mono text-xs">{r.txId}</td>
                  <td className="py-2 px-4 border-b">
                    <Badge variant={
                      ['approved', 'completed'].includes(r.status) ? 'success' :
                      r.status === 'rejected' ? 'destructive' :
                      'warning'
                    }>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="py-2 px-4 border-b">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {r.approvedAt ? new Date(r.approvedAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NewStrategyPage;
