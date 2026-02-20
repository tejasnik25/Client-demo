"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import '../../../../../styles/themes.css';
import Badge from '@/components/ui/Badge';

type RunningStrategy = {
  id: string;
  userId: string;
  userName: string;
  strategyId: string;
  strategyName: string;
  plan: 'Pro' | 'Expert' | 'Premium';
  capital: number;
  platform?: 'MT4' | 'MT5' | null;
  mtAccountId?: string | null;
  mtAccountPassword?: string | null;
  mtAccountServer?: string | null;
  adminStatus: string;
  createdAt?: string;
  expiresAt?: string;
};

const PendingRenewalStrategyPage = () => {
  const [strategies, setStrategies] = useState<RunningStrategy[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [allStrats, setAllStrats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = async () => {
    try {
      const [strategiesRes, paymentsRes, sres] = await Promise.all([
        fetch('/api/admin/running-strategies', { cache: 'no-store' }),
        fetch('/api/payments'),
        fetch('/api/strategies', { cache: 'no-store' }),
      ]);

      const strategiesData = await strategiesRes.json();
      const paymentsData = await paymentsRes.json();
      const sdata = sres.ok ? await sres.json() : { strategies: [] };

      if (!strategiesRes.ok) throw new Error('Failed to load strategies');

      const allPayments = Array.isArray(paymentsData.payments) ? paymentsData.payments : [];
      setPayments(allPayments);
      setAllStrats(Array.isArray(sdata) ? sdata : (sdata.strategies || []));

      // Get running strategies
      const allStrategies = (strategiesData.strategies || []).map((r: any) => ({
        id: r.id,
        userId: r.userId,
        userName: r.userName,
        strategyId: r.strategyId,
        strategyName: r.strategyName,
        plan: r.plan,
        capital: r.capital,
        platform: r.platform ?? null,
        mtAccountId: r.mtAccountId ?? null,
        mtAccountPassword: r.mtAccountPassword ?? null,
        mtAccountServer: r.mtAccountServer ?? null,
        adminStatus: r.adminStatus || 'in-process',
        createdAt: r.createdAt,
      }));

      // Filter for renewal strategy payments that are approved/completed
      const approvedRenewalPayments = allPayments.filter(
        (p: any) => {
          const status = p.status?.toLowerCase() || '';
          return status.includes('renewal') && p.status === 'renewal_approved';
        }
      );

      // Create a map of userId + strategyId to payment for matching
      const paymentMapByKey = new Map<string, any>();
      approvedRenewalPayments.forEach((p: any) => {
        // Normalize field names - handle both snake_case and camelCase
        const userId = String(p.user_id || p.userId || '').trim();
        const strategyId = String(p.strategy_id || p.strategyId || p.strategy?.id || '').trim();
        if (userId && strategyId) {
          const key = `${userId}::${strategyId}`;
          // Store multiple payments if there are multiple (keep the most recent)
          const existing = paymentMapByKey.get(key);
          const pDate = p.updated_at || p.created_at || '';
          const existingDate = existing?.updated_at || existing?.created_at || '';
          if (!existing || pDate > existingDate) {
            paymentMapByKey.set(key, { ...p, userId, strategyId });
          }
        }
      });

      // Filter for pending strategies (adminStatus != 'running') that are associated with renewal payments
      const pendingStrategies = allStrategies.filter((s: RunningStrategy) => {
        if (s.adminStatus === 'running') return false; // Skip running strategies
        
        const userId = String(s.userId || '').trim();
        const strategyId = String(s.strategyId || '').trim();
        if (!userId || !strategyId) return false;
        
        // Try exact match first
        const key = `${userId}::${strategyId}`;
        if (paymentMapByKey.has(key)) return true;
        
        // Also check if any payment matches (in case IDs are formatted differently)
        for (const [_, payment] of paymentMapByKey.entries()) {
          if (String(payment.userId).trim() === userId && 
              String(payment.strategyId).trim() === strategyId) {
            return true;
          }
        }
        
        return false;
      });

      // Add expiry date from payment
      const strategiesWithExpiry = pendingStrategies.map((s: RunningStrategy) => {
        const key = `${String(s.userId || '').trim()}::${String(s.strategyId || '').trim()}`;
        let payment = paymentMapByKey.get(key);
        
        // If no direct match, try to find by comparing IDs
        if (!payment) {
          for (const [_, p] of paymentMapByKey.entries()) {
            if (String(p.userId).trim() === String(s.userId).trim() && 
                String(p.strategyId).trim() === String(s.strategyId).trim()) {
              payment = p;
              break;
            }
          }
        }
        
        let expiresAt = undefined;
        if (payment && (payment.updated_at || payment.created_at)) {
          const approvalDate = new Date(payment.updated_at || payment.created_at);
          expiresAt = new Date(approvalDate.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
        }
        return { ...s, expiresAt };
      });

      setStrategies(strategiesWithExpiry);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load strategies');
      setStrategies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    return strategies.filter((s) => {
      const matchesSearch = 
        !search || 
        s.userId?.toLowerCase().includes(search.toLowerCase()) ||
        s.userName?.toLowerCase().includes(search.toLowerCase()) ||
        s.strategyName?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = !statusFilter || s.adminStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [strategies, search, statusFilter]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/running-strategies/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      await load();
    } catch (e) {
      console.error('Failed to update status:', e);
      alert('Failed to update status');
    }
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
    } catch (e) {
      console.error('Failed to update details:', e);
    }
  };

  const renderStatusBadge = (status: string) => {
    const k = (status || '').toLowerCase();
    if (k === 'running') return <Badge variant="success">Running</Badge>;
    if (k === 'in-process' || k === 'in_process') return <Badge variant="warning">In-Process</Badge>;
    if (k === 'wrong-account-password') return <Badge variant="destructive">Wrong-Account Password</Badge>;
    if (k === 'wrong-account-id') return <Badge variant="destructive">Wrong-Account Id</Badge>;
    if (k === 'wrong-account-server-name') return <Badge variant="destructive">Wrong-Account Server Name</Badge>;
    if (k === 'disconnected') return <Badge variant="destructive">Disconnected</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const plans = Array.from(new Set(strategies.map((s) => s.plan).filter(Boolean)));
  const statuses = Array.from(new Set(strategies.map((s) => s.adminStatus).filter(Boolean)));

  return (
    <div className="p-4 md:p-6 text-white min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <div>
          <Link href="/admin/plan-usage/renewal-strategy" className="text-blue-400 hover:underline mb-2 inline-block">
            ← Back to Renewal Strategy
          </Link>
          <h1 className="text-2xl font-bold">Pending Renewal Strategy</h1>
        </div>
        <button
          onClick={load}
          className="flex items-center px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700"
        >
          <ArrowPathIcon className="h-5 w-5 mr-2" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500 text-white p-3 rounded-lg mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="font-semibold">Retry</button>
        </div>
      )}

      <div className="table-card">
        <div className="table-toolbar">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="toolbar-input"
          />
          {/* Plan filter removed */}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="toolbar-select">
            <option value="">All Statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full payments-table table-sticky">
            <thead>
              <tr>
                <th>User ID</th>
                <th>User Name</th>
                <th>Strategy</th>
                <th>Lot Size</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center">Loading...</td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((s) => (
                  <tr key={s.id}>
                    <td>{s.userId}</td>
                    <td>{s.userName}</td>
                    <td>{s.strategyName}</td>
                    <td>
                      {(() => {
                        const strat = allStrats.find((st: any) => st.id === s.strategyId || st.name === s.strategyName);
                        const lp = strat?.parameters?.lotPricing || null;
                        if (!lp) return '-';
                        try {
                          const arr = JSON.parse(lp);
                          if (!Array.isArray(arr)) return '-';
                          const rows = arr
                            .map((x: any) => ({ amountUSD: Number(x.amountUSD), lot: Number(x.lot) }))
                            .filter((x: any) => Number.isFinite(x.amountUSD) && x.amountUSD > 0 && Number.isFinite(x.lot) && x.lot > 0);
                          if (rows.length === 0) return '-';
                          const amt = Number(s.capital);
                          if (!Number.isFinite(amt)) return '-';
                          const exact = rows.find((r: any) => Math.abs(r.amountUSD - amt) < 1e-6);
                          const target = exact || rows.reduce((best: any, cur: any) => {
                            const dBest = Math.abs(best.amountUSD - amt);
                            const dCur = Math.abs(cur.amountUSD - amt);
                            return dCur < dBest ? cur : best;
                          }, rows[0]);
                          return `${target.lot} Lot`;
                        } catch {
                          return '-';
                        }
                      })()}
                    </td>
                    <td>
                      <div className="space-y-2">
                        {renderStatusBadge(s.adminStatus)}
                        <select
                          value={s.adminStatus}
                          onChange={(e) => updateStatus(s.id, e.target.value)}
                          className="px-3 py-2 rounded border border-[#283046] bg-[#0f1527] text-white w-full"
                        >
                          <option value="in-process">In-Process</option>
                          <option value="wrong-account-password">Wrong-Account Password</option>
                          <option value="wrong-account-id">Wrong-Account Id</option>
                          <option value="wrong-account-server-name">Wrong-Account Server-Name</option>
                          <option value="running">Running</option>
                          <option value="disconnected">Disconnected</option>
                        </select>
                      </div>
                    </td>
                    <td>{s.createdAt ? new Date(s.createdAt).toLocaleString() : '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-gray-500">
                    No pending renewal strategies available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PendingRenewalStrategyPage;

