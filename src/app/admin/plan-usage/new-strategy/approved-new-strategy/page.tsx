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

const ApprovedNewStrategyPage = () => {
  const [strategies, setStrategies] = useState<RunningStrategy[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = async () => {
    try {
      const [strategiesRes, paymentsRes] = await Promise.all([
        fetch('/api/admin/running-strategies', { cache: 'no-store' }),
        fetch('/api/payments'),
      ]);

      const strategiesData = await strategiesRes.json();
      const paymentsData = await paymentsRes.json();

      if (!strategiesRes.ok) throw new Error('Failed to load strategies');

      const allPayments = Array.isArray(paymentsData.payments) ? paymentsData.payments : [];
      setPayments(allPayments);

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

      // Filter for new strategy payments (not renewal) that are approved/completed
      const approvedNewPayments = allPayments.filter(
        (p: any) => {
          const status = (p.status || '').toLowerCase();
          return !status.includes('renewal') && (p.status === 'approved' || p.status === 'completed');
        }
      );

      // Create multiple maps for flexible matching
      const paymentMapById = new Map<string, any>();
      const paymentMapByKey = new Map<string, any>();
      
      approvedNewPayments.forEach((p: any) => {
        // Normalize field names - handle both snake_case and camelCase
        const userId = String(p.user_id || p.userId || '').trim();
        const strategyId = String(p.strategy_id || p.strategyId || p.strategy?.id || '').trim();
        
        if (userId && strategyId) {
          // Create key with normalized values
          const key = `${userId}::${strategyId}`;
          
          // Also store by payment ID for reference
          if (p.id) {
            paymentMapById.set(p.id, { ...p, userId, strategyId });
          }
          
          // Store by composite key (keep most recent)
          const existing = paymentMapByKey.get(key);
          const pDate = p.updated_at || p.created_at || '';
          const existingDate = existing?.updated_at || existing?.created_at || '';
          if (!existing || pDate > existingDate) {
            paymentMapByKey.set(key, { ...p, userId, strategyId });
          }
        }
      });

      // Filter for approved strategies (adminStatus = 'running')
      let approvedStrategies = allStrategies.filter((s: RunningStrategy) => {
        return s.adminStatus === 'running';
      });
      
      // Filter out strategies that have matching renewal payments (only show new strategy ones)
      approvedStrategies = approvedStrategies.filter((s: RunningStrategy) => {
        const userId = String(s.userId || '').trim();
        const strategyId = String(s.strategyId || '').trim();
        if (!userId || !strategyId) return false; // Exclude if we can't determine
        
        // Check if this strategy has a renewal payment - if so, exclude it
        const renewalPayments = allPayments.filter((p: any) => {
          const pStatus = (p.status || '').toLowerCase();
          return pStatus.includes('renewal');
        });
        
        // Check if any renewal payment matches this strategy
        for (const p of renewalPayments) {
          const pUserId = String(p.user_id || p.userId || p.user?.id || '').trim();
          const pStrategyId = String(p.strategy_id || p.strategyId || p.strategy?.id || '').trim();
          if (pUserId === userId && pStrategyId === strategyId) {
            return false; // This is a renewal strategy, exclude it
          }
        }
        
        // If no renewal payment matches, it's a new strategy - include it
        return true;
      });

      // Add expiry date from payment
      const strategiesWithExpiry = approvedStrategies.map((s: RunningStrategy) => {
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
      
      // Debug logging (remove in production)
      if (process.env.NODE_ENV === 'development') {
        console.log('Approved New Strategy Debug:', {
          totalStrategies: allStrategies.length,
          runningStrategies: allStrategies.filter((s: RunningStrategy) => s.adminStatus === 'running').length,
          approvedNewPayments: approvedNewPayments.length,
          finalApprovedStrategies: strategiesWithExpiry.length,
        });
      }
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
      const matchesPlan = !planFilter || s.plan === planFilter;
      const matchesPlatform = !platformFilter || s.platform === platformFilter;
      const createdAt = s.createdAt ? new Date(s.createdAt).getTime() : 0;
      const fromOk = !dateFrom || createdAt >= new Date(dateFrom).getTime();
      const toOk = !dateTo || createdAt <= new Date(dateTo).getTime() + 24 * 60 * 60 * 1000;
      return matchesSearch && matchesPlan && matchesPlatform && fromOk && toOk;
    });
  }, [strategies, search, planFilter, platformFilter, dateFrom, dateTo]);

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

  const exportCSV = () => {
    const header = [
      "User ID", "User Name", "Strategy", "Plan", "Account Capital", "MT Type", "MT Password", "MT Server", "Status", "Expiry Date"
    ];
    const csv = [header.join(",")]
      .concat(
        filtered.map((s) => {
          return [
            s.userId || '',
            s.userName || '',
            s.strategyName || '',
            s.plan || '',
            s.capital || 0,
            s.platform || '',
            s.mtAccountPassword || '',
            s.mtAccountServer || '',
            s.adminStatus || '',
            s.expiresAt ? new Date(s.expiresAt).toISOString() : ''
          ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
        })
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "approved-new-strategies.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Note: Export Excel removed — CSV export covers same functionality

  const plans = Array.from(new Set(strategies.map((s) => s.plan).filter(Boolean)));
  const platforms = Array.from(new Set(strategies.map((s) => s.platform).filter(Boolean)));

  return (
    <div className="p-4 md:p-6 text-white min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <div>
          <Link href="/admin/plan-usage/new-strategy" className="text-blue-400 hover:underline mb-2 inline-block">
            ← Back to New Strategy
          </Link>
          <h1 className="text-2xl font-bold">Approved New Strategy</h1>
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
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="toolbar-select">
            <option value="">All Plans</option>
            {plans.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="toolbar-select">
            <option value="">All Platforms</option>
            {platforms.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="toolbar-input" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="toolbar-input" />
          <button onClick={load} className="toolbar-button">
            <ArrowPathIcon className="h-5 w-5" />
          </button>
          <button onClick={exportCSV} className="toolbar-button">CSV</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full payments-table table-sticky">
            <thead>
              <tr>
                <th>User ID</th>
                <th>User Name</th>
                <th>Strategy</th>
                <th>Plan</th>
                <th>Account Capital</th>
                <th>MT Type</th>
                <th>MT Password</th>
                <th>MT Server</th>
                <th>Status</th>
                <th>Expiry Date</th>
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
                    <td>{s.plan}</td>
                    <td>${s.capital}</td>
                    <td>{s.platform || '-'}</td>
                    <td>{s.mtAccountPassword || '-'}</td>
                    <td>{s.mtAccountServer || '-'}</td>
                    <td>
                      <div className="space-y-2">
                        <Badge variant="success">Running</Badge>
                        <select
                          value={s.adminStatus}
                          onChange={(e) => updateStatus(s.id, e.target.value)}
                          className="px-3 py-2 rounded border border-[#283046] bg-[#0f1527] text-white w-full"
                        >
                          <option value="running">Running</option>
                          <option value="in-process">In-Process</option>
                          <option value="wrong-account-password">Wrong-Account Password</option>
                          <option value="wrong-account-id">Wrong-Account Id</option>
                          <option value="wrong-account-server-name">Wrong-Account Server-Name</option>
                          <option value="disconnected">Disconnected</option>
                        </select>
                      </div>
                    </td>
                    <td>
                      {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-gray-500">
                    No approved new strategies available
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

export default ApprovedNewStrategyPage;

