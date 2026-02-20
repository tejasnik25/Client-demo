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
  adminStatus: string;
  createdAt?: string;
  lotLabel?: string;
};

const ApprovedNewStrategyPage = () => {
  const [strategies, setStrategies] = useState<RunningStrategy[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = async () => {
    try {
      const [strategiesRes, paymentsRes, allStratsRes] = await Promise.all([
        fetch('/api/admin/running-strategies', { cache: 'no-store' }),
        fetch('/api/payments'),
        fetch('/api/strategies', { cache: 'no-store' }),
      ]);

      const strategiesData = await strategiesRes.json();
      const paymentsData = await paymentsRes.json();
      const allStratsData = await allStratsRes.json().catch(() => ({ strategies: [] }));

      if (!strategiesRes.ok) throw new Error('Failed to load strategies');

      const allPayments = Array.isArray(paymentsData.payments) ? paymentsData.payments : [];
      setPayments(allPayments);

      const stratMap = new Map<string, any>();
      (allStratsData.strategies || []).forEach((s: any) => {
        if (s.id) stratMap.set(String(s.id), s);
        if (s.name) stratMap.set(String(s.name), s);
      });

      const allStrategies = (strategiesData.strategies || []).map((r: any) => ({
        id: r.id,
        userId: r.userId,
        userName: r.userName,
        strategyId: r.strategyId,
        strategyName: r.strategyName,
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

      const strategiesWithLot = approvedStrategies.map((s: RunningStrategy) => {
        const userId = String(s.userId || '').trim();
        const stratId = String(s.strategyId || '').trim();
        const stratName = String(s.strategyName || '').trim();
        const keyById = `${userId}::${stratId}`;
        let payment = paymentMapByKey.get(keyById);

        // If no direct id match, try composite matching across entries
        if (!payment) {
          for (const [_, p] of paymentMapByKey.entries()) {
            const pUser = String(p.userId || '').trim();
            const pStratId = String(p.strategyId || '').trim();
            const pStratName = String(p.strategy?.name || p.strategyName || '').trim();
            if (pUser === userId && (pStratId === stratId || (pStratName && pStratName === stratName))) {
              payment = p;
              break;
            }
          }
        }

        let lotLabel: string | undefined = undefined;
        const strat = stratMap.get(stratId) || stratMap.get(stratName);
        const lp = strat?.parameters?.lotPricing || null;
        if (lp) {
          try {
            const rows = JSON.parse(lp);
            if (Array.isArray(rows)) {
              const parsed = rows
                .map((x: any) => ({ amountUSD: Number(x.amountUSD), lot: Number(x.lot) }))
                .filter((x: any) => Number.isFinite(x.amountUSD) && x.amountUSD > 0 && Number.isFinite(x.lot) && x.lot > 0);
              const amt = Number(payment?.payable ?? payment?.amount ?? NaN);
              if (parsed.length > 0 && Number.isFinite(amt)) {
                const exact = parsed.find((r: any) => Math.abs(r.amountUSD - amt) < 1e-6);
                const target = exact || parsed.reduce((best: any, cur: any) => {
                  const dBest = Math.abs(best.amountUSD - amt);
                  const dCur = Math.abs(cur.amountUSD - amt);
                  return dCur < dBest ? cur : best;
                }, parsed[0]);
                lotLabel = `${target.lot} Lot`;
              }
            }
          } catch {}
        }

        return { ...s, lotLabel };
      });

      setStrategies(strategiesWithLot);
      setError(null);
      
      // Debug logging (remove in production)
      if (process.env.NODE_ENV === 'development') {
        console.log('Approved New Strategy Debug:', {
          totalStrategies: allStrategies.length,
          runningStrategies: allStrategies.filter((s: RunningStrategy) => s.adminStatus === 'running').length,
          approvedNewPayments: approvedNewPayments.length,
          finalApprovedStrategies: strategiesWithLot.length,
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
      const createdAt = s.createdAt ? new Date(s.createdAt).getTime() : 0;
      const fromOk = !dateFrom || createdAt >= new Date(dateFrom).getTime();
      const toOk = !dateTo || createdAt <= new Date(dateTo).getTime() + 24 * 60 * 60 * 1000;
      return matchesSearch && fromOk && toOk;
    });
  }, [strategies, search, dateFrom, dateTo]);

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
      "User ID", "User Name", "Strategy", "Lot Size", "Status"
    ];
    const csv = [header.join(",")]
      .concat(
        filtered.map((s) => {
          return [
            s.userId || '',
            s.userName || '',
            s.strategyName || '',
            s.lotLabel || '',
            s.adminStatus || ''
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

  // Removed plan/platform filters

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
          {/* Filters for Plan/Platform removed */}
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
                <th>Lot Size</th>
                <th>Status</th>
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
                    <td>{s.lotLabel || '-'}</td>
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
                          <option value="disconnected">Disconnected</option>
                        </select>
                      </div>
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

