"use client";

import React, { useState, useEffect } from 'react';

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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Plan Usage</h1>
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
                <td className="py-2 px-4 border-b">{r.platform || '-'}</td>
                <td className="py-2 px-4 border-b">{r.mtAccountPassword || '-'}</td>
                <td className="py-2 px-4 border-b">{r.mtAccountServer || '-'}</td>
                <td className="py-2 px-4 border-b">
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