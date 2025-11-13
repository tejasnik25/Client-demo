"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FaMoneyBillWave } from 'react-icons/fa';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

type Payment = {
  id: string;
  userId: string;
  strategyId: string;
  plan: 'Pro' | 'Expert' | 'Premium';
  capital: number;
  payable: number;
  method: 'USDT_ERC20' | 'USDT_TRC20' | 'UPI';
  txId: string;
  proofUrl: string;
  status: string;
  createdAt?: string;
};

const PaymentsPage = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [walletRes, renewalRes] = await Promise.all([
          fetch('/api/payments?renewal=false'),
          fetch('/api/payments?renewal=true'),
        ]);
        const walletData = await walletRes.json();
        const renewalData = await renewalRes.json();
        if (!walletRes.ok) throw new Error(walletData.error || 'Failed to load wallet');
        if (!renewalRes.ok) throw new Error(renewalData.error || 'Failed to load renewals');
        const wallet: Payment[] = (walletData.payments ?? []) as Payment[];
        const renewals: Payment[] = (renewalData.payments ?? []) as Payment[];
        setPayments([...wallet, ...renewals]);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
        setPayments([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const stats = useMemo(() => {
    const totalLocal = payments.length;
    const approvedLocal = payments.filter(p => p.status === 'completed' || p.status === 'approved' || p.status === 'renewal_approved').length;
    const pendingLocal = payments.filter(p => p.status === 'pending' || p.status === 'in-process' || p.status === 'in_process' || p.status === 'renewal_pending').length;
    const renewalsLocal = payments.filter(p => p.status?.startsWith('renewal_')).length;
    const amountCollectedLocal = payments
      .filter(p => p.status === 'completed' || p.status === 'approved' || p.status === 'renewal_approved')
      .reduce((sum, p) => sum + (p.payable || 0), 0);
    return { total: totalLocal, pending: pendingLocal, approved: approvedLocal, renewals: renewalsLocal, totalAmountCollected: amountCollectedLocal };
  }, [payments]);

  // Try to hydrate stats from admin analytics when available
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch('/api/admin/analytics');
        if (!res.ok) return; // Keep local stats
        const a = await res.json();
        if (a?.payments) {
          // Override selected stats for consistency with backend
          setPayments((prev) => prev); // no-op to keep deps happy
        }
      } catch (e) {
        // ignore and keep local calculations
      }
    };
    fetchAnalytics();
  }, []);

  // Monthly trends (count by month YYYY-MM)
  const monthlyTrends = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments) {
      const created = p.createdAt ? new Date(p.createdAt) : null;
      if (!created) continue;
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    // Limit to last 6-12 points for readability
    const trimmed = entries.slice(-8);
    return trimmed.map(([month, count]) => ({ month, count }));
  }, [payments]);

  // Payment method breakdown (counts)
  const methodBreakdown = useMemo(() => {
    const methods = ['USDT_ERC20', 'USDT_TRC20', 'UPI'] as const;
    const counts: Record<string, number> = {};
    for (const m of methods) counts[m] = 0;
    for (const p of payments) {
      counts[p.method] = (counts[p.method] || 0) + 1;
    }
    return methods
      .map((m) => ({ name: m, value: counts[m] || 0 }))
      .filter((d) => d.value > 0 || payments.length === 0) // keep empty state
  }, [payments]);

  const PIE_COLORS = ['#60a5fa', '#34d399', '#fbbf24'];

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">Payments Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow flex items-center gap-3"><FaMoneyBillWave className="text-blue-500 text-2xl" /><div><p className="text-sm">Total Transactions</p><p className="text-2xl font-bold">{stats.total}</p></div></div>
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow flex items-center gap-3"><span className="text-green-500 text-2xl">✔</span><div><p className="text-sm">Total Approved</p><p className="text-2xl font-bold">{stats.approved}</p></div></div>
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow flex items-center gap-3"><span className="text-yellow-500 text-2xl">⏳</span><div><p className="text-sm">Total Pending</p><p className="text-2xl font-bold">{stats.pending}</p></div></div>
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow flex items-center gap-3"><span className="text-purple-500 text-2xl">↻</span><div><p className="text-sm">Total Renewals</p><p className="text-2xl font-bold">{stats.renewals}</p></div></div>
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow flex items-center gap-3"><span className="text-green-600 text-2xl">$</span><div><p className="text-sm">Total Revenue</p><p className="text-2xl font-bold">${stats.totalAmountCollected.toFixed(2)}</p></div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
          <h2 className="text-lg font-semibold mb-3">Monthly Transaction Trends</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrends} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" tick={{ fill: 'currentColor', fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: 'currentColor', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#60a5fa" strokeWidth={2} dot={false} name="Transactions" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
          <h2 className="text-lg font-semibold mb-3">Payment Method Breakdown (3D Pie)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={methodBreakdown} dataKey="value" nameKey="name" outerRadius={90} fill="#8884d8" label>
                  {methodBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/admin/payments/pending" className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow">
          <FaMoneyBillWave className="text-4xl text-blue-500 mb-4" />
          <h2 className="text-xl font-semibold">Pending Transactions</h2>
          <p className="text-gray-600 dark:text-gray-400">Review and approve new payments.</p>
        </Link>
        <Link href="/admin/payments/approved" className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow">
          <FaMoneyBillWave className="text-4xl text-green-500 mb-4" />
          <h2 className="text-xl font-semibold">Approved Transactions</h2>
          <p className="text-gray-600 dark:text-gray-400">View verified payments and export.</p>
        </Link>
        <Link href="/admin/payments/renewal/pending" className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow">
          <FaMoneyBillWave className="text-4xl text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold">Renewal Pending</h2>
          <p className="text-gray-600 dark:text-gray-400">Approve or hold renewal payments.</p>
        </Link>
        <Link href="/admin/payments/renewal/approved" className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow">
          <FaMoneyBillWave className="text-4xl text-purple-500 mb-4" />
          <h2 className="text-xl font-semibold">Renewal Approved</h2>
          <p className="text-gray-600 dark:text-gray-400">Track renewal approvals and expiry.</p>
        </Link>
      </div>
      <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-3">Recent Transactions</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">user_id</th>
                <th className="p-2">Transaction ID</th>
                <th className="p-2">User</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Payment Method</th>
                <th className="p-2">Date</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.slice(0, 15).map(p => (
                <tr key={p.id} className="border-b">
                  <td className="p-2">{p.userId}</td>
                  <td className="p-2">{p.txId}</td>
                  <td className="p-2">{p.userId}</td>
                  <td className="p-2">{p.payable}</td>
                  <td className="p-2">{p.method}</td>
                  <td className="p-2">{p.createdAt ? new Date(p.createdAt).toLocaleString() : '-'}</td>
                  <td className="p-2">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PaymentsPage;