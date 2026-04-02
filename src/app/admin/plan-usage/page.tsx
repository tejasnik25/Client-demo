"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

type StrategyItem = {
  id: string;
  userId: string;
  userName: string;
  strategyName: string;
  plan: 'Pro' | 'Expert' | 'Premium';
  capital: number;
  adminStatus: 'in-process' | 'wrong-account-password' | 'wrong-account-id' | 'wrong-account-server-name' | 'running';
};

type Payment = {
  id: string;
  status: string;
  strategyId: string;
};

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

const PlanUsagePage = () => {
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [modifications, setModifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [strategiesRes, paymentsRes, modsRes] = await Promise.all([
        fetch('/api/admin/running-strategies', { cache: 'no-store' }),
        fetch('/api/payments'),
        fetch('/api/admin/running-strategies/modifications').catch(() => ({ ok: false, json: () => ({ modifications: [] }) }))
      ]);
      
      const strategiesData = await strategiesRes.json();
      const paymentsData = await paymentsRes.json();
      const modsData = await modsRes.json();
      
      if (!strategiesRes.ok) throw new Error(strategiesData.error || 'Failed to load strategies');
      
      const items = (strategiesData.strategies || []).map((r: any) => ({
        id: r.id,
        userId: r.userId,
        userName: r.userName,
        strategyName: r.strategyName,
        plan: r.plan,
        capital: r.capital,
        adminStatus: r.adminStatus || 'in-process',
      }));
      setStrategies(items);
      
      const allPayments = Array.isArray(paymentsData.payments) ? paymentsData.payments : [];
      setPayments(allPayments);
      
      const allMods = modsData.modifications || [];
      setModifications(allMods);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
      setStrategies([]);
      setPayments([]);
      setModifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const running = strategies.filter(s => s.adminStatus === 'running').length;
    const disconnected = strategies.filter(s => (s.adminStatus || '').toLowerCase() === 'disconnected').length;
    
    const newPending = payments.filter(p => !p.status?.includes('renewal') && ['pending', 'in_process', 'in-process'].includes(p.status)).length;
    const newApproved = payments.filter(p => !p.status?.includes('renewal') && ['approved', 'completed'].includes(p.status)).length;
    const newRejected = payments.filter(p => !p.status?.includes('renewal') && p.status === 'rejected').length;
    
    const renewalPending = payments.filter(p => p.status === 'renewal_pending').length;
    const renewalApproved = payments.filter(p => p.status === 'renewal_approved').length;
    const renewalRejected = payments.filter(p => p.status === 'renewal_rejected' || (p.status?.includes('renewal') && p.status === 'rejected')).length;
    
    const modificationPending = modifications.filter(m => m.status === 'pending' || m.status === 'in-process').length;
    const modificationApproved = modifications.filter(m => m.status === 'approved' || m.status === 'running').length;
    const stopCopyingInProcess = modifications.filter((m: any) => {
      try {
        const req = typeof m.new_update_json === 'string' ? JSON.parse(m.new_update_json || '{}') : m.new_update_json;
        return req?.action === 'disconnect' && String(m.status).toLowerCase() === 'in-process';
      } catch {
        return false;
      }
    }).length;

    return {
      running,
      disconnected,
      newPending,
      newApproved,
      newRejected,
      renewalPending,
      renewalApproved,
      renewalRejected,
      modificationPending,
      modificationApproved,
      stopCopyingInProcess
    };
  }, [strategies, payments, modifications]);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  const runningStatusData = [
    { name: 'Running', value: stats.running },
    { name: 'Disconnected', value: stats.disconnected }
  ];

  const newStrategyData = [
    { name: 'Pending', value: stats.newPending },
    { name: 'Approved', value: stats.newApproved },
    { name: 'Rejected', value: stats.newRejected }
  ];

  const renewalStrategyData = [
    { name: 'Pending', value: stats.renewalPending },
    { name: 'Approved', value: stats.renewalApproved },
    { name: 'Rejected', value: stats.renewalRejected }
  ];

  const modificationStrategyData = [
    { name: 'Pending', value: stats.modificationPending },
    { name: 'Approved', value: stats.modificationApproved }
  ];

  const overviewData = [
    { category: 'Total Running', count: stats.running },
    { category: 'Total Disconnected', count: stats.disconnected },
    { category: 'New Strategies', count: stats.newPending + stats.newApproved + stats.newRejected },
    { category: 'Renewal Strategies', count: stats.renewalPending + stats.renewalApproved + stats.renewalRejected },
    { category: 'Modifications', count: stats.modificationPending + stats.modificationApproved }
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">Plan Usage Analytics</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Link href="/admin/plan-usage/total-running-strategy" className="block p-4 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-shadow">
          <h3 className="text-sm text-gray-500 mb-1">Total Running Strategy</h3>
          <p className="text-2xl font-bold text-green-600">{stats.running}</p>
        </Link>
        <Link href="/admin/plan-usage/total-disconnected-strategy" className="block p-4 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-shadow">
          <h3 className="text-sm text-gray-500 mb-1">Total Disconnected Strategy</h3>
          <p className="text-2xl font-bold text-red-600">{stats.disconnected}</p>
        </Link>
        <Link href="/admin/plan-usage/new-strategy" className="block p-4 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-shadow">
          <h3 className="text-sm text-gray-500 mb-1">New Strategy</h3>
          <p className="text-2xl font-bold text-blue-600">{stats.newPending + stats.newApproved + stats.newRejected}</p>
        </Link>
        <Link href="/admin/plan-usage/renewal-strategy" className="block p-4 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-shadow">
          <h3 className="text-sm text-gray-500 mb-1">Renewal Strategy</h3>
          <p className="text-2xl font-bold text-purple-600">{stats.renewalPending + stats.renewalApproved + stats.renewalRejected}</p>
        </Link>
        <Link href="/admin/plan-usage/modification-strategy" className="block p-4 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-shadow">
          <h3 className="text-sm text-gray-500 mb-1">Modification Strategy</h3>
          <p className="text-2xl font-bold text-orange-600">{stats.modificationPending + stats.modificationApproved}</p>
        </Link>
        <Link href="/admin/plan-usage/stop-copying" className="block p-4 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-shadow">
          <h3 className="text-sm text-gray-500 mb-1">Stop Copying Requests</h3>
          <p className="text-2xl font-bold text-red-600">{stats.stopCopyingInProcess || 0}</p>
        </Link>
        <Link href="/admin/plan-usage/all-settlements" className="block p-4 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-shadow">
          <h3 className="text-sm text-gray-500 mb-1">All Settlements</h3>
          <p className="text-2xl font-bold text-indigo-600">View</p>
        </Link>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 rounded-lg bg-white border border-gray-200">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Running vs Disconnected</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={runningStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {runningStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', color: '#000' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="p-4 rounded-lg bg-white border border-gray-200">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">New Strategy Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={newStrategyData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {newStrategyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', color: '#000' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 rounded-lg bg-white border border-gray-200">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Renewal Strategy Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={renewalStrategyData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {renewalStrategyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', color: '#000' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="p-4 rounded-lg bg-white border border-gray-200">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Modification Strategy Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={modificationStrategyData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {modificationStrategyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', color: '#000' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Overview Bar Chart */}
      <div className="p-4 rounded-lg bg-white border border-gray-200">
        <h2 className="text-lg font-semibold mb-3 text-gray-900">System Overview</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={overviewData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', color: '#000' }} />
            <Legend />
            <Bar dataKey="count" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/plan-usage/total-running-strategy" className="block p-4 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-shadow">
          <h3 className="font-semibold mb-2 text-gray-900">Total Running Strategy</h3>
          <p className="text-sm text-gray-500">View all running strategies</p>
        </Link>
        <Link href="/admin/plan-usage/total-disconnected-strategy" className="block p-4 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-shadow">
          <h3 className="font-semibold mb-2 text-gray-900">Total Disconnected Strategy</h3>
          <p className="text-sm text-gray-500">View all disconnected strategies</p>
        </Link>
        <Link href="/admin/plan-usage/modification" className="block p-4 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-shadow">
          <h3 className="font-semibold mb-2 text-gray-900">Modifications</h3>
          <p className="text-sm text-gray-500">Manage strategy modifications</p>
        </Link>
      </div>
    </div>
  );
};

export default PlanUsagePage;
