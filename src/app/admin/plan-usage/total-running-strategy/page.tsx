"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';

type Item = {
  id: string;
  userId: string;
  userName: string;
  strategyName: string;
  plan: string; // deprecated
  capital: number; // deprecated
  lotSize?: string | null;
  adminStatus: string;
  createdAt?: string;
};

const TotalRunningStrategyPage = () => {
  const [rows, setRows] = useState<Item[]>([]);
  const [paymentMap, setPaymentMap] = useState<Record<string, any>>({});
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('');

  const load = async () => {
    try {
      const [res, paysRes, sres] = await Promise.all([
        fetch('/api/admin/running-strategies', { cache: 'no-store' }),
        fetch('/api/admin/payments/approved', { cache: 'no-store' }),
        fetch('/api/strategies', { cache: 'no-store' })
      ]);
      const data = await res.json();
      const paysData = await paysRes.json().catch(() => []);
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      if (sres.ok) {
        const sdata = await sres.json();
        setStrategies(Array.isArray(sdata) ? sdata : (sdata.strategies || []));
      } else {
        setStrategies([]);
      }
      const items = (data.strategies || []).map((r: any) => ({
        id: r.id,
        userId: r.userId,
        userName: r.userName,
        strategyName: r.strategyName,
        plan: r.plan,
        capital: r.capital,
        lotSize: null,
        adminStatus: (r.adminStatus || r.admin_status || 'in-process').toLowerCase(),
        createdAt: r.createdAt,
      }));
      // build payments map for deriving lot size
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

      // Filter only running strategies
      const runningStrategies = items.filter((item: Item) => item.adminStatus === 'running');
      setRows(runningStrategies);
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
      return matchesSearch && matchesPlan;
    });
  }, [rows, searchTerm, planFilter]);

  const exportCSV = () => {
    const header = [
      "User ID",
      "User Name",
      "Strategy Name",
      "Lot Size",
      "Status",
      "Created At"
    ];
    const csv = [header.join(",")]
      .concat(
        filteredRows.map((r) => {
          return [
            r.userId || '',
            r.userName || '',
            r.strategyName || '',
            (function () {
              const k = `${r.userId}::${r.strategyName}`;
              const pay = paymentMap[k];
              const s = strategies.find((st: any) => st.name === r.strategyName || st.id === r.id);
              const lp = s?.parameters?.lotPricing;
              if (!lp || !pay) return '';
              try {
                const arr = JSON.parse(lp);
                if (!Array.isArray(arr)) return '';
                const rows = arr
                  .map((x: any) => ({ amountUSD: Number(x.amountUSD), lot: Number(x.lot) }))
                  .filter((x: any) => Number.isFinite(x.amountUSD) && x.amountUSD > 0 && Number.isFinite(x.lot) && x.lot > 0);
                if (rows.length === 0) return '';
                const amt = Number(pay.amount);
                if (!Number.isFinite(amt)) return '';
                const exact = rows.find((rr: any) => Math.abs(rr.amountUSD - amt) < 1e-6);
                const target = exact || rows.reduce((best: any, cur: any) => {
                  const dBest = Math.abs(best.amountUSD - amt);
                  const dCur = Math.abs(cur.amountUSD - amt);
                  return dCur < dBest ? cur : best;
                }, rows[0]);
                return `${target.lot} Lot`;
              } catch {
                return '';
              }
            })(),
            r.adminStatus || '',
            r.createdAt ? new Date(r.createdAt).toISOString() : ''
          ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
        })
      ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "total-running-strategies.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Note: Export Excel removed — CSV export covers same functionality

  

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Total Running Strategy</h1>
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
        {/* Plan filter removed */}
        {/* Platform filter removed; lot size based plans */}
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
        Showing {filteredRows.length} of {rows.length} running strategies
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">User ID</th>
              <th className="py-2 px-4 border-b">User Name</th>
              <th className="py-2 px-4 border-b">Strategy</th>
              <th className="py-2 px-4 border-b">Lot Size</th>
              <th className="py-2 px-4 border-b">Status</th>
              <th className="py-2 px-4 border-b">Created At</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-4 text-center text-gray-400">
                  No running strategies found
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 px-4 border-b">{r.userId}</td>
                  <td className="py-2 px-4 border-b">{r.userName}</td>
                  <td className="py-2 px-4 border-b">{r.strategyName}</td>
                  <td className="py-2 px-4 border-b">
                    {(() => {
                      const s = strategies.find((st: any) => st.name === r.strategyName || st.id === r.id);
                      const lp = s?.parameters?.lotPricing;
                      if (!lp) return '-';
                      try {
                        const arr = JSON.parse(lp);
                        if (!Array.isArray(arr)) return '-';
                        const rows = arr
                          .map((x: any) => ({ amountUSD: Number(x.amountUSD), lot: Number(x.lot) }))
                          .filter((x) => Number.isFinite(x.amountUSD) && x.amountUSD > 0 && Number.isFinite(x.lot) && x.lot > 0);
                        if (rows.length === 0) return '-';
                        const k = `${r.userId}::${r.strategyName}`;
                        const pay = paymentMap[k];
                        const amt = Number(pay?.amount);
                        if (!Number.isFinite(amt)) return '-';
                        const exact = rows.find((rr) => Math.abs(rr.amountUSD - amt) < 1e-6);
                        const target = exact || rows.reduce((best, cur) => {
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
                  <td className="py-2 px-4 border-b">
                    <Badge variant="success">Running</Badge>
                  </td>
                  <td className="py-2 px-4 border-b">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}
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

export default TotalRunningStrategyPage;

