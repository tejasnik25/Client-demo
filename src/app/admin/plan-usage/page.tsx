"use client";

import React, { useState, useEffect } from 'react';
import Badge from '@/components/ui/Badge';

type Item = {
  id: string;
  userId: string;
  userName: string;
  strategyName: string;
  plan: 'Pro' | 'Expert' | 'Premium';
  capital: number;
  platform?: 'MT4' | 'MT5' | null;
  mtAccountPassword?: string | null;
  mtAccountServer?: string | null;
  adminStatus: 'in-process' | 'wrong-account-password' | 'wrong-account-id' | 'wrong-account-server-name' | 'running';
};

const PlanUsagePage = () => {
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSub, setShowSub] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/admin/running-strategies');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const items = (data.strategies || []).map((r: any) => ({
        id: r.id,
        userId: r.userId,
        userName: r.userName,
        strategyName: r.strategyName,
        plan: r.plan,
        capital: r.capital,
        platform: r.platform ?? null,
        mtAccountPassword: r.mtAccountPassword ?? null,
        mtAccountServer: r.mtAccountServer ?? null,
        adminStatus: r.adminStatus || 'in-process',
      }));
      setRows(items);
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

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  const updateStatus = async (id: string, status: Item['adminStatus']) => {
    try {
      const res = await fetch(`/api/admin/running-strategies/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setRows(prev => prev.map(r => r.id === id ? { ...r, adminStatus: status } : r));
    } catch {}
  };

  const renderStatusBadge = (s: Item['adminStatus']) => {
    const k = (s || '').toLowerCase();
    if (k === 'running') return <Badge variant="success">Running</Badge>;
    if (k === 'in-process') return <Badge variant="warning">In-Process</Badge>;
    if (k === 'wrong-account-password') return <Badge variant="destructive">Wrong-Account Password</Badge>;
    if (k === 'wrong-account-id') return <Badge variant="destructive">Wrong-Account Id</Badge>;
    if (k === 'wrong-account-server-name') return <Badge variant="destructive">Wrong-Account Server Name</Badge>;
    return <Badge variant="outline">{s}</Badge>;
  };

  const updateDetails = async (id: string, payload: Partial<{ platform: 'MT4' | 'MT5'; mt_account_password: string; mt_account_server: string }>) => {
    try {
      const res = await fetch(`/api/admin/running-strategies/${id}/details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update details');
      await load();
    } catch {}
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Plan Usage</h1>
        <button onClick={() => setShowSub(v => !v)} className="text-sm px-3 py-2 rounded bg-[#1a1f2e] border border-[#283046] text-gray-300">
          {showSub ? 'Hide' : 'Show'} Modifications
        </button>
      </div>
      {showSub && (
        <div className="mb-4">
          <a href="/admin/plan-usage/modification" className="inline-flex items-center px-3 py-2 rounded bg-[#283046] text-white">
            Open Modifications
          </a>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">User ID</th>
              <th className="py-2 px-4 border-b">User Name</th>
              <th className="py-2 px-4 border-b">Strategy</th>
              <th className="py-2 px-4 border-b">Plan</th>
              <th className="py-2 px-4 border-b">Account Capital</th>
              <th className="py-2 px-4 border-b">MT Type</th>
              <th className="py-2 px-4 border-b">MT Password</th>
              <th className="py-2 px-4 border-b">MT Server</th>
              <th className="py-2 px-4 border-b">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2 px-4 border-b">{r.userId}</td>
                <td className="py-2 px-4 border-b">{r.userName}</td>
                <td className="py-2 px-4 border-b">{r.strategyName}</td>
                <td className="py-2 px-4 border-b">{r.plan}</td>
                <td className="py-2 px-4 border-b">{r.capital}</td>
                <td className="py-2 px-4 border-b">
                  <select
                    value={r.platform || ''}
                    onChange={(e) => updateDetails(r.id, { platform: (e.target.value || undefined) as any })}
                    className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                  >
                    <option value="">-</option>
                    <option value="MT4">MT4</option>
                    <option value="MT5">MT5</option>
                  </select>
                </td>
                <td className="py-2 px-4 border-b">
                  <input
                    defaultValue={r.mtAccountPassword || ''}
                    placeholder="Password"
                    className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                    onBlur={(e) => updateDetails(r.id, { mt_account_password: e.target.value })}
                  />
                </td>
                <td className="py-2 px-4 border-b">
                  <input
                    defaultValue={r.mtAccountServer || ''}
                    placeholder="Server"
                    className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                    onBlur={(e) => updateDetails(r.id, { mt_account_server: e.target.value })}
                  />
                </td>
                <td className="py-2 px-4 border-b space-y-2">
                  {renderStatusBadge(r.adminStatus)}
                  <select
                    value={r.adminStatus}
                    onChange={(e) => updateStatus(r.id, e.target.value as Item['adminStatus'])}
                    className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                  >
                    <option value="in-process">In-Process</option>
                    <option value="wrong-account-password">Wrong-Account Password</option>
                    <option value="wrong-account-id">Wrong-Account Id</option>
                    <option value="wrong-account-server-name">Wrong-Account Server-Name</option>
                    <option value="running">Running</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlanUsagePage;