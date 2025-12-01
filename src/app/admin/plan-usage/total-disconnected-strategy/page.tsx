"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';

type Item = {
  id: string;
  userId: string;
  userName: string;
  strategyName: string;
  plan: 'Pro' | 'Expert' | 'Premium';
  capital: number;
  platform?: 'MT4' | 'MT5' | null;
  mtAccountId?: string | null;
  mtAccountPassword?: string | null;
  mtAccountServer?: string | null;
  adminStatus: string;
  status?: string;
  createdAt?: string;
};

const TotalDisconnectedStrategyPage = () => {
  const [rows, setRows] = useState<Item[]>([]);
  const [paymentMap, setPaymentMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = async () => {
    try {
      const [res, paysRes] = await Promise.all([fetch('/api/admin/running-strategies', { cache: 'no-store' }), fetch('/api/admin/payments/approved', { cache: 'no-store' })]);
      const data = await res.json();
      const paysData = await paysRes.json().catch(() => []);
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const items = (data.strategies || []).map((r: any) => ({
        id: r.id,
        userId: r.userId,
        userName: r.userName,
        strategyName: r.strategyName,
        plan: r.plan,
        capital: r.capital,
        platform: r.platform ?? null,
        mtAccountId: r.mtAccountId ?? null,
        mtAccountPassword: r.mtAccountPassword ?? null,
        mtAccountServer: r.mtAccountServer ?? null,
        adminStatus: (r.adminStatus || r.admin_status || 'in-process')?.toLowerCase(),
        status: (r.status || '')?.toLowerCase(),
        createdAt: r.createdAt,
      }));
      // build payments map for expiry calculation
      try {
        const pays: any[] = Array.isArray(paysData) ? paysData : (paysData.transactions || []);
        const payMap: Record<string, any> = {};
        const key = (u: string, s: string) => `${u}::${s}`;
        pays.forEach((t: any) => {
          const strat = t.strategy?.name || t.strategy_id;
          if (!strat) return;
          payMap[key(t.user_id, strat)] = t;
        });
        setPaymentMap(payMap);
      } catch (e) {
        setPaymentMap({});
      }

      // Filter only disconnected strategies (not running)
      // Show only actual disconnected strategies
      const disconnectedStrategies = items.filter((item: Item) => {
        const a = (item.adminStatus || '').toLowerCase();
        const s = (item.status || '').toLowerCase();
        return a === 'disconnected' || s === 'stopped';
      });
      setRows(disconnectedStrategies);
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
        r.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.strategyName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPlan = !planFilter || r.plan === planFilter;
      const matchesPlatform = !platformFilter || r.platform === platformFilter;
      const matchesStatus = !statusFilter || r.adminStatus === statusFilter;
      return matchesSearch && matchesPlan && matchesPlatform && matchesStatus;
    });
  }, [rows, searchTerm, planFilter, platformFilter, statusFilter]);

  const renderStatusBadge = (status: string) => {
    const k = (status || '').toLowerCase();
    if (k === 'in-process') return <Badge variant="warning">In-Process</Badge>;
    if (k === 'wrong-account-password') return <Badge variant="destructive">Wrong-Account Password</Badge>;
    if (k === 'wrong-account-id') return <Badge variant="destructive">Wrong-Account Id</Badge>;
    if (k === 'wrong-account-server-name') return <Badge variant="destructive">Wrong-Account Server Name</Badge>;
    if (k === 'disconnected' || k === 'stopped') return <Badge variant="destructive">Disconnected</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const exportCSV = () => {
    const header = [
      "User ID",
      "User Name",
      "Strategy Name",
      "Plan",
      "Capital",
      "Platform",
      "MT Account ID",
      "MT Account Server",
      "Status",
      "Created At",
      "Expiry Date"
    ];
    const csv = [header.join(",")]
      .concat(
        filteredRows.map((r) => {
          return [
            r.userId || '',
            r.userName || '',
            r.strategyName || '',
            r.plan || '',
            r.capital || 0,
            r.platform || '',
            r.mtAccountId || '',
            r.mtAccountServer || '',
            r.adminStatus || '',
            r.createdAt ? new Date(r.createdAt).toISOString() : '',
            (function(){ const k = `${r.userId}::${r.strategyName}`; const pay = paymentMap[k]; const approval = pay ? (pay.updated_at || pay.created_at) : undefined; const expiry = approval ? new Date(new Date(approval).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() : ''; return expiry; })()
          ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
        })
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "total-disconnected-strategies.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Note: Export Excel removed — CSV export covers same functionality

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(rows.map(r => r.adminStatus))).filter(Boolean);
  }, [rows]);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Total Disconnected Strategy</h1>
        <Link href="/admin/plan-usage" className="text-sm px-3 py-2 rounded bg-[#1a1f2e] border border-[#283046] text-gray-300 hover:bg-[#283046]">
          Back to Plan Usage
        </Link>
      </div>

      {/* Filters and Export */}
      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium mb-1">Search</label>
          <input
            type="text"
            placeholder="Search by User ID, Name, or Strategy..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 rounded bg-[#0f1527] border border-[#283046] text-white"
          />
        </div>
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium mb-1">Plan</label>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="w-full px-3 py-2 rounded bg-[#0f1527] border border-[#283046] text-white"
          >
            <option value="">All Plans</option>
            <option value="Pro">Pro</option>
            <option value="Expert">Expert</option>
            <option value="Premium">Premium</option>
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium mb-1">Platform</label>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="w-full px-3 py-2 rounded bg-[#0f1527] border border-[#283046] text-white"
          >
            <option value="">All Platforms</option>
            <option value="MT4">MT4</option>
            <option value="MT5">MT5</option>
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded bg-[#0f1527] border border-[#283046] text-white"
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
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
        Showing {filteredRows.length} of {rows.length} disconnected strategies
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">User ID</th>
              <th className="py-2 px-4 border-b">User Name</th>
              <th className="py-2 px-4 border-b">Strategy</th>
              <th className="py-2 px-4 border-b">Plan</th>
              <th className="py-2 px-4 border-b">Account Capital</th>
              <th className="py-2 px-4 border-b">Platform</th>
              <th className="py-2 px-4 border-b">MT Account ID</th>
              <th className="py-2 px-4 border-b">MT Server</th>
              <th className="py-2 px-4 border-b">Status</th>
              <th className="py-2 px-4 border-b">Created At</th>
              <th className="py-2 px-4 border-b">Expiry Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-4 text-center text-gray-400">
                  No disconnected strategies found
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 px-4 border-b">{r.userId}</td>
                  <td className="py-2 px-4 border-b">{r.userName}</td>
                  <td className="py-2 px-4 border-b">{r.strategyName}</td>
                  <td className="py-2 px-4 border-b">{r.plan}</td>
                  <td className="py-2 px-4 border-b">{r.capital}</td>
                  <td className="py-2 px-4 border-b">{r.platform || '-'}</td>
                  <td className="py-2 px-4 border-b">{r.mtAccountId || '-'}</td>
                  <td className="py-2 px-4 border-b">{r.mtAccountServer || '-'}</td>
                  <td className="py-2 px-4 border-b">
                    {renderStatusBadge(r.adminStatus)}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}
                  </td>
                  <td className="py-2 px-4 border-b">{
                    (() => {
                      const k = `${r.userId}::${r.strategyName}`;
                      const pay = paymentMap[k];
                      const approval = pay ? (pay.updated_at || pay.created_at) : undefined;
                      const expiry = approval ? new Date(new Date(approval).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() : undefined;
                      return expiry ? new Date(expiry).toLocaleDateString() : '-';
                    })()
                  }</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TotalDisconnectedStrategyPage;

