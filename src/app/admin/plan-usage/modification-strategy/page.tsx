"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';

type Modification = {
  id: string;
  running_strategy_id: string;
  user_id: string;
  userName?: string;
  strategyName?: string;
  plan?: string;
  platform?: 'MT4' | 'MT5' | null;
  mt_account_id?: string | null;
  mt_account_password?: string | null;
  mt_account_server?: string | null;
  status: string;
  created_at?: string;
  new_update_json?: any;
};

const ModificationStrategyPage = () => {
  const [rows, setRows] = useState<Modification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [planFilter, setPlanFilter] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<string>('');

  const formatUpdateRequest = (u: any) => {
    if (!u) return '-';
    try { if (typeof u === 'string') u = JSON.parse(u); } catch (e) {}
    if (!u || typeof u !== 'object') return String(u);
    const parts: string[] = [];
    if (u.platform) parts.push(`Platform: ${u.platform}`);
    if (u.mt_account_password) parts.push('Password change');
    if (u.mt_account_id) parts.push(`ID: ${u.mt_account_id}`);
    if (u.mt_account_server) parts.push(`Server: ${u.mt_account_server}`);
    if (u.action && String(u.action).toLowerCase() === 'enable') parts.push('Enable strategy');
    if (u.action && String(u.action).toLowerCase() === 'disconnect') parts.push('Disconnect strategy');
    Object.keys(u).forEach(k => {
      if (['platform','mt_account_password','mt_account_id','mt_account_server', 'action'].includes(k)) return;
      parts.push(`${k}: ${u[k]}`);
    });
    return parts.length ? parts.join('; ') : '-';
  };

  const load = async () => {
    try {
      const [modsRes, runsRes] = await Promise.all([
        fetch('/api/admin/running-strategies/modifications'),
        fetch('/api/admin/running-strategies', { cache: 'no-store' }),
      ]);
      
      const modsData = await modsRes.json();
      const runsData = await runsRes.json();
      
      if (!modsRes.ok) throw new Error('Failed to load modifications');
      
      // Map running strategies for user/strategy names
      const runMap: Record<string, any> = {};
      (runsData.strategies || []).forEach((r: any) => { 
        runMap[r.id] = r; 
      });

      const list: Modification[] = (modsData.modifications || []).map((m: any) => {
        const runStrat = runMap[m.running_strategy_id];
        return {
          id: m.id,
          running_strategy_id: m.running_strategy_id,
          user_id: m.user_id,
          userName: runStrat?.userName || m.user_id,
          strategyName: runStrat?.strategyName || '-',
          plan: runStrat?.plan || '-',
          platform: m.platform ?? null,
          mt_account_id: m.mt_account_id ?? null,
          mt_account_password: m.mt_account_password ?? null,
          mt_account_server: m.mt_account_server ?? null,
          status: m.status,
          new_update_json: m.new_update_json ? (typeof m.new_update_json === 'string' ? JSON.parse(m.new_update_json) : m.new_update_json) : undefined,
          created_at: m.created_at,
        };
      });
      
      setRows(list);
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
        r.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.strategyName || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = !statusFilter || r.status === statusFilter;
      const matchesPlan = !planFilter || r.plan === planFilter;
      const matchesPlatform = !platformFilter || r.platform === platformFilter;
      
      return matchesSearch && matchesStatus && matchesPlan && matchesPlatform;
    });
  }, [rows, searchTerm, statusFilter, planFilter, platformFilter]);

  const exportCSV = () => {
    const header = [
      "User ID",
      "User Name",
      "Strategy",
      "Plan",
      "Platform",
      "MT Account ID",
      "MT Server",
      "Request Details",
      "Status",
      "Created At"
    ];
    const csv = [header.join(",")]
      .concat(
        filteredRows.map((r) => {
          return [
            r.user_id || '',
            r.userName || '',
            r.strategyName || '',
            r.plan || '',
            r.platform || '',
            r.mt_account_id || '',
            r.mt_account_server || '',
            formatUpdateRequest(r.new_update_json),
            r.status || '',
            r.created_at ? new Date(r.created_at).toISOString() : ''
          ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
        })
      ).join("\n");
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modifications.csv";
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
        <h1 className="text-3xl font-bold text-gray-900">Modification Strategy</h1>
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
            placeholder="Search by User or Strategy..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white border border-gray-200 text-gray-900"
          />
        </div>
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium mb-1 text-gray-700">Plan</label>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white border border-gray-200 text-gray-900"
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
            className="w-full px-3 py-2 rounded bg-white border border-gray-200 text-gray-900"
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
            className="w-full px-3 py-2 rounded bg-white border border-gray-200 text-gray-900"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="running">Running</option>
            <option value="rejected">Rejected</option>
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
        Showing {filteredRows.length} of {rows.length} modifications
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">User Name</th>
              <th className="py-2 px-4 border-b">Strategy</th>
              <th className="py-2 px-4 border-b">Platform</th>
              <th className="py-2 px-4 border-b">MT Account ID</th>
              <th className="py-2 px-4 border-b">MT Server</th>
              <th className="py-2 px-4 border-b">Request Details</th>
              <th className="py-2 px-4 border-b">Status</th>
              <th className="py-2 px-4 border-b">Created At</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-4 text-center text-gray-400">
                  No modifications found
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 px-4 border-b">
                    <div className="font-medium">{r.userName || r.user_id}</div>
                  </td>
                  <td className="py-2 px-4 border-b">{r.strategyName}</td>
                  <td className="py-2 px-4 border-b">{r.plan}</td>
                  <td className="py-2 px-4 border-b">{r.platform || '-'}</td>
                  <td className="py-2 px-4 border-b">{r.mt_account_id || '-'}</td>
                  <td className="py-2 px-4 border-b">{r.mt_account_server || '-'}</td>
                  <td className="py-2 px-4 border-b text-sm max-w-xs truncate" title={formatUpdateRequest(r.new_update_json)}>
                    {formatUpdateRequest(r.new_update_json)}
                  </td>
                  <td className="py-2 px-4 border-b">
                    <Badge variant={
                      ['approved', 'running'].includes(r.status) ? 'success' :
                      r.status === 'rejected' ? 'destructive' :
                      'warning'
                    }>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="py-2 px-4 border-b">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : '-'}
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

export default ModificationStrategyPage;
