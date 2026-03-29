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

const PendingNewStrategyPage = () => {
  const [strategies, setStrategies] = useState<RunningStrategy[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modDescByRunId, setModDescByRunId] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const [strategiesRes, paymentsRes, allStratsRes, modsRes] = await Promise.all([
        fetch('/api/admin/running-strategies', { cache: 'no-store' }),
        fetch('/api/payments'),
        fetch('/api/strategies', { cache: 'no-store' }),
        fetch('/api/admin/running-strategies/modifications', { cache: 'no-store' }).catch(() => null),
      ]);

      const strategiesData = await strategiesRes.json();
      const paymentsData = await paymentsRes.json();
      const allStratsData = await allStratsRes.json().catch(() => ({ strategies: [] }));
      const modsData = await modsRes?.json().catch(() => ({ modifications: [] })) || { modifications: [] };

      if (!strategiesRes.ok) throw new Error('Failed to load strategies');

      const allPayments = Array.isArray(paymentsData.payments) ? paymentsData.payments : [];
      setPayments(allPayments);

      const stratMap = new Map<string, any>();
      (allStratsData.strategies || []).forEach((s: any) => {
        stratMap.set(String(s.id), s);
        if (s.name) stratMap.set(String(s.name), s);
      });

      // Get running strategies (strip legacy MT fields)
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
      const paymentMapByKey = new Map<string, any>();
      
      approvedNewPayments.forEach((p: any) => {
        // Normalize field names - handle both snake_case and camelCase
        const userId = String(p.user_id || p.userId || '').trim();
        const strategyId = String(p.strategy_id || p.strategyId || p.strategy?.id || '').trim();
        
        if (userId && strategyId) {
          // Create key with normalized values
          const key = `${userId}::${strategyId}`;
          
          // Store by composite key (keep most recent)
          const existing = paymentMapByKey.get(key);
          const pDate = p.updated_at || p.created_at || '';
          const existingDate = existing?.updated_at || existing?.created_at || '';
          if (!existing || pDate > existingDate) {
            paymentMapByKey.set(key, { ...p, userId, strategyId });
          }
        }
      });

      // Filter for pending strategies (exclude finalized states)
      let pendingStrategies = allStrategies.filter((s: RunningStrategy) => {
        const k = (s.adminStatus || '').toLowerCase();
        return k !== 'running' && k !== 'disconnected';
      });
      
      // Filter out strategies that have matching renewal payments (only show new strategy ones)
      pendingStrategies = pendingStrategies.filter((s: RunningStrategy) => {
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

      // Attach lot label from strategy lotPricing and payment amount
      const strategiesWithLot = pendingStrategies.map((s: RunningStrategy) => {
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

        let lotLabel: string | undefined = undefined;
        const strat = stratMap.get(s.strategyId) || stratMap.get(s.strategyName);
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
          } catch { /* ignore */ }
        }

        return { ...s, lotLabel };
      });

      // Build modification description map
      const modMap: Record<string, string> = {};
      const mods = Array.isArray(modsData.modifications) ? modsData.modifications : [];
      for (const m of mods) {
        const rsId = String(m.running_strategy_id || m.runningStrategyId || '').trim();
        const status = String(m.status || '').toLowerCase();
        if (!rsId || status !== 'in-process') continue;
        let nu: any = m.new_update_json;
        if (typeof nu === 'string') {
          try { nu = JSON.parse(nu); } catch { nu = {}; }
        }
        const action = String(nu?.action || '').toLowerCase();
        if (action === 'disconnect') {
          modMap[rsId] = 'Requested for Disconnect';
        } else if (action === 'enable' || action === 'connect') {
          modMap[rsId] = 'Requested for Connect';
        }
      }
      setModDescByRunId(modMap);

      setStrategies(strategiesWithLot);
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
      console.log(`[PendingNewStrategy] Updating status for ${id} to ${status}`);
      const res = await fetch(`/api/admin/running-strategies/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      console.log(`[PendingNewStrategy] Response for ${id}: ${res.status} ${res.statusText}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error(`[PendingNewStrategy] Error updating status:`, errData);
        throw new Error(errData.error || 'Failed to update status');
      }
      await load();
      console.log(`[PendingNewStrategy] Reloaded strategies after successful update`);
    } catch (e: any) {
      console.error('Failed to update status:', e);
      alert(`Failed to update status: ${e.message}`);
    }
  };

  // MT account details removed

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

  const statuses = Array.from(new Set(strategies.map((s) => s.adminStatus).filter(Boolean)));

  return (
    <div className="p-4 md:p-6 text-white min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <div>
          <Link href="/admin/plan-usage/new-strategy" className="text-blue-400 hover:underline mb-2 inline-block">
            ← Back to New Strategy
          </Link>
          <h1 className="text-2xl font-bold">Pending New Strategy</h1>
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
              <th>Request</th>
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
                        {renderStatusBadge(s.adminStatus)}
                        <select
                          value={s.adminStatus}
                          onChange={(e) => updateStatus(s.id, e.target.value)}
                          className="px-3 py-2 rounded border border-[#283046] bg-[#0f1527] text-white w-full"
                        >
                          <option value="in-process">In-Process</option>
                          <option value="running">Completed</option>
                          <option value="disconnected">Disconnected</option>
                        </select>
                      </div>
                    </td>
                  <td>
                    <div className="text-xs text-gray-400">
                      {modDescByRunId[s.id] || '-'}
                    </div>
                  </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-gray-500">
                    No pending new strategies available
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

export default PendingNewStrategyPage;

