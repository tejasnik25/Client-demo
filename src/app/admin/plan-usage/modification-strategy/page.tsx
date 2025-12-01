"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import Badge from '@/components/ui/Badge';

type Modification = {
  id: string;
  running_strategy_id: string;
  user_id: string;
  userName?: string;
  strategyName?: string;
  platform?: 'MT4' | 'MT5' | null;
  mt_account_id?: string | null;
  mt_account_password?: string | null;
  mt_account_server?: string | null;
  status: string;
  created_at?: string;
  new_update_json?: any;
};

const COLORS = ['#10b981', '#f59e0b'];

const ModificationStrategyPage = () => {
  const [modifications, setModifications] = useState<Modification[]>([]);
  const [runMap, setRunMap] = useState<Record<string, any>>({});
  const [paymentMap, setPaymentMap] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const formatUpdateRequest = (u: any) => {
    if (!u) return '-';
    try { if (typeof u === 'string') u = JSON.parse(u); } catch (e) {}
    if (!u || typeof u !== 'object') return String(u);
    const parts: string[] = [];
    if (u.platform) parts.push(`Request to change platform to ${u.platform}`);
    if (u.mt_account_password) parts.push('Request to change password');
    if (u.mt_account_id) parts.push(`Request to change account ID to ${u.mt_account_id}`);
    if (u.mt_account_server) parts.push(`Request to change server to ${u.mt_account_server}`);
    if (u.action && String(u.action).toLowerCase() === 'enable') parts.push('Request to enable the strategy');
    if (u.action && String(u.action).toLowerCase() === 'disconnect') parts.push('Request to disconnect strategy');
    Object.keys(u).forEach(k => {
      if (['platform','mt_account_password','mt_account_id','mt_account_server'].includes(k)) return;
      parts.push(`Request to change ${k} to ${u[k]}`);
    });
    return parts.length ? parts.join('; ') : '-';
  };

  const load = async () => {
    try {
      const [modsRes, runsRes] = await Promise.all([
        fetch('/api/admin/running-strategies/modifications'),
          fetch('/api/admin/running-strategies', { cache: 'no-store' }),
      ]);
      const [aprRes] = await Promise.all([fetch('/api/admin/payments/approved')]);
      
      const modsData = await modsRes.json();
      const runsData = await runsRes.json();
      
      if (!modsRes.ok) throw new Error('Failed to load modifications');
      
      const list: Modification[] = (modsData.modifications || []).map((m: any) => ({
        id: m.id,
        running_strategy_id: m.running_strategy_id,
        user_id: m.user_id,
        platform: m.platform ?? null,
        mt_account_id: m.mt_account_id ?? null,
        mt_account_password: m.mt_account_password ?? null,
        mt_account_server: m.mt_account_server ?? null,
        status: m.status,
        new_update_json: m.new_update_json ? (typeof m.new_update_json === 'string' ? JSON.parse(m.new_update_json) : m.new_update_json) : undefined,
        created_at: m.created_at,
      }));
      
      setModifications(list);
      
      // Map running strategies for user/strategy names
      const map: Record<string, any> = {};
      (runsData.strategies || []).forEach((r: any) => { 
        map[r.id] = r; 
      });
      setRunMap(map);
      // build payment map to compute expiry
      try {
        const aprData = await aprRes.json().catch(() => []);
        const pays: any[] = Array.isArray(aprData) ? aprData : (aprData.transactions || []);
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
      
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load modifications');
      setModifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Enhance modifications with user/strategy names
  const enhancedModifications = useMemo(() => {
    return modifications.map(m => {
      const info = runMap[m.running_strategy_id] || {};
      return {
        ...m,
        userName: info.userName,
        strategyName: info.strategyName,
        plan: info.plan,
      };
    });
  }, [modifications, runMap]);

  const filteredEnhanced = enhancedModifications.filter((m) => {
    const plan = (m as any).plan || '';
    const name = m.userName || '';
    const strat = m.strategyName || '';
    const matchesSearch = !searchTerm || m.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) || name?.toLowerCase().includes(searchTerm.toLowerCase()) || strat?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = !planFilter || plan === planFilter;
    const matchesPlatform = !platformFilter || (m.platform || '') === platformFilter;
    return matchesSearch && matchesPlan && matchesPlatform;
  });

  const exportCSV = () => {
    const header = [
      "User ID",
      "User Name",
      "Strategy",
      "New Update Request",
      "Plan",
      "Platform",
      "MT Account ID",
      "MT Server",
      "Status",
      "Created At",
      "Expiry Date"
    ];
    const csv = [header.join(',')]
      .concat(
        filteredEnhanced.map((m) => {
          const k = `${m.user_id}::${m.strategyName}`;
          const pay = paymentMap[k];
          const approval = pay ? (pay.updated_at || pay.created_at) : undefined;
          const expiry = approval ? new Date(new Date(approval).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() : '';
          const nu = m.new_update_json ? formatUpdateRequest(m.new_update_json) : '';
          return [
            m.user_id || '',
            m.userName || '',
            nu || '',
            m.strategyName || '',
            (m as any).plan || '',
            m.platform || '',
            m.mt_account_id || '',
            m.mt_account_server || '',
            m.status || '',
            m.created_at ? new Date(m.created_at).toISOString() : '',
            expiry || ''
          ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
        })
      ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modification-strategy.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Note: Export Excel removed — CSV export covers same functionality

  const stats = useMemo(() => {
    const pending = enhancedModifications.filter(m => m.status === 'pending' || m.status === 'in-process' || !m.status || m.status === '').length;
    const approved = enhancedModifications.filter(m => m.status === 'approved' || m.status === 'running').length;
    return { pending, approved };
  }, [enhancedModifications]);

  const pendingModifications = useMemo(() => {
    return filteredEnhanced
      .filter(m => m.status === 'pending' || m.status === 'in-process' || !m.status || m.status === '')
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10); // Last 10 entries
  }, [filteredEnhanced]);

  const approvedModifications = useMemo(() => {
    return filteredEnhanced
      .filter(m => m.status === 'approved' || m.status === 'running')
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10); // Last 10 entries
  }, [filteredEnhanced]);

  const statusData = [
    { name: 'Pending', value: stats.pending },
    { name: 'Approved', value: stats.approved }
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
        <h1 className="text-3xl font-bold">Modification Strategy Analytics</h1>
        <Link href="/admin/plan-usage" className="text-sm px-3 py-2 rounded bg-[#1a1f2e] border border-[#283046] text-gray-300 hover:bg-[#283046]">
          Back to Plan Usage
        </Link>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
          <h3 className="text-sm text-gray-500 mb-1">Pending Modification Strategy</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
          <Link href="/admin/plan-usage/modification" className="text-sm text-blue-500 hover:underline mt-2 inline-block">
            View all →
          </Link>
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
          <h3 className="text-sm text-gray-500 mb-1">Approved Modification Strategy</h3>
          <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
          <Link href="/admin/plan-usage/modification" className="text-sm text-blue-500 hover:underline mt-2 inline-block">
            View all →
          </Link>
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
          <h2 className="text-lg font-semibold mb-3">Modification Strategy Status Distribution</h2>
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
          <h2 className="text-lg font-semibold mb-3">Modification Strategy Status Overview</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters & Export */}
      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium mb-1">Search</label>
          <input
            type="text"
            placeholder="Search by User ID, Name or Strategy..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 rounded bg-[#0f1527] border border-[#283046] text-white"
          />
        </div>
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium mb-1">Plan</label>
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="w-full px-3 py-2 rounded bg-[#0f1527] border border-[#283046] text-white">
            <option value="">All Plans</option>
            <option value="Pro">Pro</option>
            <option value="Expert">Expert</option>
            <option value="Premium">Premium</option>
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium mb-1">Platform</label>
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="w-full px-3 py-2 rounded bg-[#0f1527] border border-[#283046] text-white">
            <option value="">All Platforms</option>
            <option value="MT4">MT4</option>
            <option value="MT5">MT5</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700">Export CSV</button>
        </div>
      </div>

      {/* Recent Pending Entries */}
      <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Pending Modification Strategy Entries</h2>
          <Link href="/admin/plan-usage/modification" className="text-sm text-blue-500 hover:underline">
            View all →
          </Link>
        </div>
        {pendingModifications.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No pending entries</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="py-2 px-4 text-left">User ID</th>
                  <th className="py-2 px-4 text-left">User Name</th>
                  <th className="py-2 px-4 text-left">Strategy</th>
                  <th className="py-2 px-4 text-left">Platform</th>
                  <th className="py-2 px-4 text-left">New Update Request</th>
                  <th className="py-2 px-4 text-left">New Update Request</th>
                  <th className="py-2 px-4 text-left">MT Account ID</th>
                  <th className="py-2 px-4 text-left">MT Server</th>
                  <th className="py-2 px-4 text-left">Created At</th>
                  <th className="py-2 px-4 text-left">Expiry Date</th>
                  <th className="py-2 px-4 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingModifications.map((m) => (
                  <tr key={m.id} className="border-b">
                    <td className="py-2 px-4">{m.user_id}</td>
                    <td className="py-2 px-4">{m.userName || '-'}</td>
                    <td className="py-2 px-4">{m.strategyName || '-'}</td>
                    <td className="py-2 px-4">{m.platform || '-'}</td>
                    <td className="py-2 px-4 max-w-[260px] truncate" title={m.new_update_json ? (typeof m.new_update_json === 'string' ? m.new_update_json : JSON.stringify(m.new_update_json)) : ''}>{m.new_update_json ? formatUpdateRequest(m.new_update_json) : '-'}</td>
                    <td className="py-2 px-4 max-w-[260px] truncate" title={m.new_update_json ? (typeof m.new_update_json === 'string' ? m.new_update_json : JSON.stringify(m.new_update_json)) : ''}>{m.new_update_json ? formatUpdateRequest(m.new_update_json) : '-'}</td>
                    <td className="py-2 px-4">{m.mt_account_id || '-'}</td>
                    <td className="py-2 px-4">{m.mt_account_server || '-'}</td>
                    <td className="py-2 px-4">
                      {m.created_at ? new Date(m.created_at).toLocaleString() : '-'}
                    </td>
                    <td className="py-2 px-4">{
                      (() => {
                        const k = `${m.user_id}::${m.strategyName}`;
                        const pay = paymentMap[k];
                        const approval = pay ? (pay.updated_at || pay.created_at) : undefined;
                        const expiry = approval ? new Date(new Date(approval).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() : undefined;
                        return expiry ? new Date(expiry).toLocaleDateString() : '-';
                      })()
                    }</td>
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
          <h2 className="text-lg font-semibold">Recent Approved Modification Strategy Entries</h2>
          <Link href="/admin/plan-usage/modification" className="text-sm text-blue-500 hover:underline">
            View all →
          </Link>
        </div>
        {approvedModifications.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No approved entries</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="py-2 px-4 text-left">User ID</th>
                  <th className="py-2 px-4 text-left">User Name</th>
                  <th className="py-2 px-4 text-left">Strategy</th>
                  <th className="py-2 px-4 text-left">Platform</th>
                  <th className="py-2 px-4 text-left">MT Account ID</th>
                  <th className="py-2 px-4 text-left">MT Server</th>
                  <th className="py-2 px-4 text-left">Created At</th>
                  <th className="py-2 px-4 text-left">Expiry Date</th>
                  <th className="py-2 px-4 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {approvedModifications.map((m) => (
                  <tr key={m.id} className="border-b">
                    <td className="py-2 px-4">{m.user_id}</td>
                    <td className="py-2 px-4">{m.userName || '-'}</td>
                    <td className="py-2 px-4">{m.strategyName || '-'}</td>
                    <td className="py-2 px-4">{m.platform || '-'}</td>
                    <td className="py-2 px-4">{m.mt_account_id || '-'}</td>
                    <td className="py-2 px-4">{m.mt_account_server || '-'}</td>
                    <td className="py-2 px-4">
                      {m.created_at ? new Date(m.created_at).toLocaleString() : '-'}
                    </td>
                    <td className="py-2 px-4">{
                      (() => {
                        const k = `${m.user_id}::${m.strategyName}`;
                        const pay = paymentMap[k];
                        const approval = pay ? (pay.updated_at || pay.created_at) : undefined;
                        const expiry = approval ? new Date(new Date(approval).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() : undefined;
                        return expiry ? new Date(expiry).toLocaleDateString() : '-';
                      })()
                    }</td>
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

export default ModificationStrategyPage;

