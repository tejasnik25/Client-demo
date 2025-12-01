"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
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

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

const NewStrategyPage = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      
      setPayments(newStrategyPayments);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const pending = payments.filter(p => ['pending', 'in_process', 'in-process'].includes(p.status)).length;
    const approved = payments.filter(p => ['approved', 'completed'].includes(p.status)).length;
    const rejected = payments.filter(p => p.status === 'rejected').length;
    return { pending, approved, rejected };
  }, [payments]);

  const pendingPayments = useMemo(() => {
    return payments
      .filter(p => ['pending', 'in_process', 'in-process'].includes(p.status))
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10); // Last 10 entries
  }, [payments]);

  const approvedPayments = useMemo(() => {
    return payments
      .filter(p => ['approved', 'completed'].includes(p.status))
      .sort((a, b) => {
        const dateA = a.approvedAt ? new Date(a.approvedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const dateB = b.approvedAt ? new Date(b.approvedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return dateB - dateA;
      })
      .slice(0, 10); // Last 10 entries
  }, [payments]);

  const statusData = [
    { name: 'Pending', value: stats.pending },
    { name: 'Approved', value: stats.approved },
    { name: 'Rejected', value: stats.rejected }
  ];

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">New Strategy Analytics</h1>
        <Link href="/admin/plan-usage" className="text-sm px-3 py-2 rounded bg-[#1a1f2e] border border-[#283046] text-gray-300 hover:bg-[#283046]">
          Back to Plan Usage
        </Link>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
          <h3 className="text-sm text-gray-500 mb-1">Pending New Strategy</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
          <Link href="/admin/plan-usage/new-strategy/pending-new-strategy" className="text-sm text-blue-500 hover:underline mt-2 inline-block">
            View all →
          </Link>
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
          <h3 className="text-sm text-gray-500 mb-1">Approved New Strategy</h3>
          <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
          <Link href="/admin/plan-usage/new-strategy/approved-new-strategy" className="text-sm text-blue-500 hover:underline mt-2 inline-block">
            View all →
          </Link>
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
          <h3 className="text-sm text-gray-500 mb-1">Rejected New Strategy</h3>
          <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
          <Link href="/admin/payments/rejected" className="text-sm text-blue-500 hover:underline mt-2 inline-block">
            View all →
          </Link>
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
          <h2 className="text-lg font-semibold mb-3">New Strategy Status Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
          <h2 className="text-lg font-semibold mb-3">New Strategy Status Overview</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Pending Entries */}
      <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Pending New Strategy Entries</h2>
          <Link href="/admin/plan-usage/new-strategy/pending-new-strategy" className="text-sm text-blue-500 hover:underline">
            View all →
          </Link>
        </div>
        {pendingPayments.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No pending entries</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="py-2 px-4 text-left">User ID</th>
                  <th className="py-2 px-4 text-left">User Name</th>
                  <th className="py-2 px-4 text-left">Strategy</th>
                  <th className="py-2 px-4 text-left">Plan</th>
                  <th className="py-2 px-4 text-left">Amount</th>
                  <th className="py-2 px-4 text-left">Payment Method</th>
                  <th className="py-2 px-4 text-left">Created At</th>
                  <th className="py-2 px-4 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2 px-4">{p.userId}</td>
                    <td className="py-2 px-4">{p.userName || '-'}</td>
                    <td className="py-2 px-4">{p.strategyName || p.strategyId}</td>
                    <td className="py-2 px-4">{p.plan}</td>
                    <td className="py-2 px-4">${p.payable}</td>
                    <td className="py-2 px-4">{p.method}</td>
                    <td className="py-2 px-4">
                      {p.createdAt ? new Date(p.createdAt).toLocaleString() : '-'}
                    </td>
                    <td className="py-2 px-4">
                      <Badge variant="warning">Pending</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Approved Entries */}
      <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Approved New Strategy Entries</h2>
          <Link href="/admin/plan-usage/new-strategy/approved-new-strategy" className="text-sm text-blue-500 hover:underline">
            View all →
          </Link>
        </div>
        {approvedPayments.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No approved entries</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="py-2 px-4 text-left">User ID</th>
                  <th className="py-2 px-4 text-left">User Name</th>
                  <th className="py-2 px-4 text-left">Strategy</th>
                  <th className="py-2 px-4 text-left">Plan</th>
                  <th className="py-2 px-4 text-left">Amount</th>
                  <th className="py-2 px-4 text-left">Payment Method</th>
                  <th className="py-2 px-4 text-left">Approved At</th>
                  <th className="py-2 px-4 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {approvedPayments.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2 px-4">{p.userId}</td>
                    <td className="py-2 px-4">{p.userName || '-'}</td>
                    <td className="py-2 px-4">{p.strategyName || p.strategyId}</td>
                    <td className="py-2 px-4">{p.plan}</td>
                    <td className="py-2 px-4">${p.payable}</td>
                    <td className="py-2 px-4">{p.method}</td>
                    <td className="py-2 px-4">
                      {p.approvedAt ? new Date(p.approvedAt).toLocaleString() : (p.createdAt ? new Date(p.createdAt).toLocaleString() : '-')}
                    </td>
                    <td className="py-2 px-4">
                      <Badge variant="success">Approved</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewStrategyPage;

