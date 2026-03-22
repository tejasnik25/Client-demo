'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { FiArrowLeft, FiDownload, FiPlayCircle } from 'react-icons/fi';
import Button from '@/components/ui/Button';

type StrategySettlementRow = {
  strategyId: string;
  strategyName: string;
  strategyCreatedAt: string;
  copiersCount: number;
  totalDeposit: number;
  totalProfit: number;
  totalSwap: number;
  openTrades: number;
  commissionPercent: number;
  lastSettlementAt: string | null;
};

type SettlementItem = {
  userId: string;
  userName: string;
  userEmail: string;
  investedAmount: number;
  grossProfit: number;
  swapAmount: number;
  commissionAmount: number;
  withdrawalAmount: number;
  settledBalance: number;
};

export default function ProfitSharingSettlementPage() {
  const [rows, setRows] = useState<StrategySettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyStrategyId, setBusyStrategyId] = useState<string | null>(null);
  const [lastItemsByStrategy, setLastItemsByStrategy] = useState<Record<string, SettlementItem[]>>({});
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/profit-sharing', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load settlement data');
      setRows(Array.isArray(json?.strategies) ? json.strategies : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load settlement data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.totalDeposit += Number(r.totalDeposit || 0);
        acc.totalProfit += Number(r.totalProfit || 0);
        acc.totalCopiers += Number(r.copiersCount || 0);
        return acc;
      },
      { totalDeposit: 0, totalProfit: 0, totalCopiers: 0 }
    );
  }, [rows]);

  const exportStrategyExcel = (strategy: StrategySettlementRow, items: SettlementItem[]) => {
    const wb = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet([
      {
        Strategy: strategy.strategyName,
        StrategyId: strategy.strategyId,
        StrategyCreatedAt: strategy.strategyCreatedAt || '',
        Copiers: strategy.copiersCount,
        TotalDeposit: strategy.totalDeposit,
        GrossProfit: strategy.totalProfit,
        Swap: strategy.totalSwap,
        CommissionPercent: strategy.commissionPercent,
        OpenTrades: strategy.openTrades,
        LastSettlementAt: strategy.lastSettlementAt || '',
      },
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Strategy Summary');

    const usersSheet = XLSX.utils.json_to_sheet(
      (items || []).map((x) => ({
        UserId: x.userId,
        UserName: x.userName,
        UserEmail: x.userEmail,
        Invested: x.investedAmount,
        GrossProfit: x.grossProfit,
        Swap: x.swapAmount,
        Commission: x.commissionAmount,
        Withdrawal: x.withdrawalAmount,
        SettledBalance: x.settledBalance,
      }))
    );
    XLSX.utils.book_append_sheet(wb, usersSheet, 'User Settlement');
    XLSX.writeFile(wb, `profit-sharing-${strategy.strategyName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const runSettlement = async (strategy: StrategySettlementRow) => {
    try {
      setBusyStrategyId(strategy.strategyId);
      const res = await fetch('/api/admin/profit-sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId: strategy.strategyId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Settlement failed');
      const items = Array.isArray(json?.items) ? json.items : [];
      setLastItemsByStrategy((prev) => ({ ...prev, [strategy.strategyId]: items }));
      exportStrategyExcel(strategy, items);
      await loadData();
      alert(`Settlement completed for "${strategy.strategyName}". Excel downloaded.`);
    } catch (e: any) {
      alert(e?.message || 'Failed to run settlement');
    } finally {
      setBusyStrategyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-600 hover:text-black">
            <FiArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profit-sharing Settlement</h1>
            <p className="text-sm text-gray-500">Strategy-wise settlement and Excel download</p>
          </div>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 text-red-700 px-4 py-3">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500 uppercase">Strategies</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500 uppercase">Total Copiers</p>
          <p className="text-2xl font-bold">{totals.totalCopiers}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500 uppercase">Total Deposit</p>
          <p className="text-2xl font-bold">${totals.totalDeposit.toFixed(2)}</p>
        </div>
      </div>

      {/* Responsive Table/Card View */}
      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-gray-400 font-medium italic">
              No strategies found
            </div>
          ) : (
            rows.map((r) => (
              <div key={r.strategyId} className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <Link 
                    href={`/admin/profit-sharing/${r.strategyId}`}
                    className="font-bold text-gray-900 hover:text-[#00d09c] transition-colors"
                  >
                    {r.strategyName}
                  </Link>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${Number(r.totalProfit || 0) >= 0 ? 'bg-green-50 text-[#00d09c]' : 'bg-red-50 text-red-500'}`}>
                    ${Number(r.totalProfit || 0).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-[11px]">
                  <div>
                    <p className="text-gray-400 font-bold uppercase tracking-tight">Copiers</p>
                    <p className="text-gray-900 font-black">{r.copiersCount}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-bold uppercase tracking-tight">Open Trades</p>
                    <p className={`font-black ${r.openTrades > 0 ? 'text-orange-500' : 'text-[#00d09c]'}`}>{r.openTrades}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-bold uppercase tracking-tight">Commission</p>
                    <p className="text-gray-900 font-black">{Number(r.commissionPercent || 0).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-bold uppercase tracking-tight">Created</p>
                    <p className="text-gray-900 font-black">{r.strategyCreatedAt ? new Date(r.strategyCreatedAt).toLocaleDateString() : '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => exportStrategyExcel(r, lastItemsByStrategy[r.strategyId] || [])}
                    className="flex-1 flex items-center justify-center gap-2 h-10 border border-gray-200 rounded-lg text-xs font-bold text-gray-600"
                  >
                    <FiDownload className="w-4 h-4" />
                    Excel
                  </button>
                  <button
                    disabled={busyStrategyId === r.strategyId || r.openTrades > 0}
                    onClick={() => runSettlement(r)}
                    className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-lg text-xs font-black uppercase tracking-widest text-white transition-all ${
                      r.openTrades > 0 
                      ? 'bg-gray-100 text-gray-300' 
                      : 'bg-[#00d09c] hover:bg-[#00b085]'
                    }`}
                  >
                    {busyStrategyId === r.strategyId ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <FiPlayCircle className="w-4 h-4" />
                        Settle
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-gray-600 uppercase text-[11px] font-black tracking-wider">
                <th className="text-left p-4">Strategy</th>
                <th className="text-left p-4">Created</th>
                <th className="text-right p-4">Copiers</th>
                <th className="text-right p-4">Deposits</th>
                <th className="text-right p-4">Profit</th>
                <th className="text-right p-4">Open Trades</th>
                <th className="text-right p-4">Commission %</th>
                <th className="text-left p-4">Last Settlement</th>
                <th className="text-center p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400 font-medium italic">
                    No strategies found
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.strategyId} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="p-4">
                      <Link 
                        href={`/admin/profit-sharing/${r.strategyId}`}
                        className="font-bold text-gray-900 hover:text-[#00d09c] transition-colors flex items-center gap-2"
                      >
                        {r.strategyName}
                      </Link>
                    </td>
                    <td className="p-4 text-gray-500">{r.strategyCreatedAt ? new Date(r.strategyCreatedAt).toLocaleDateString() : '-'}</td>
                    <td className="p-4 text-right font-semibold">{r.copiersCount}</td>
                    <td className="p-4 text-right text-gray-900 font-medium">${Number(r.totalDeposit || 0).toLocaleString()}</td>
                    <td className={`p-4 text-right font-black ${Number(r.totalProfit || 0) >= 0 ? 'text-[#00d09c]' : 'text-red-500'}`}>
                      ${Number(r.totalProfit || 0).toLocaleString()}
                    </td>
                    <td className={`p-4 text-right ${r.openTrades > 0 ? 'text-orange-500 font-black' : 'text-[#00d09c] font-bold'}`}>
                      {r.openTrades}
                    </td>
                    <td className="p-4 text-right font-bold text-gray-700">{Number(r.commissionPercent || 0).toFixed(1)}%</td>
                    <td className="p-4 text-gray-500 text-[11px]">{r.lastSettlementAt ? new Date(r.lastSettlementAt).toLocaleString() : '-'}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => exportStrategyExcel(r, lastItemsByStrategy[r.strategyId] || [])}
                          className="flex flex-col items-center justify-center min-w-[50px] h-10 border border-gray-200 rounded-md hover:bg-gray-50 transition-all text-gray-600 hover:text-gray-900"
                          title="Download Excel"
                        >
                          <FiDownload className="w-4 h-4" />
                          <span className="text-[8px] font-black uppercase mt-0.5">Excel</span>
                        </button>
                        <button
                          disabled={busyStrategyId === r.strategyId || r.openTrades > 0}
                          onClick={() => runSettlement(r)}
                          className={`flex items-center justify-center w-10 h-10 rounded-md transition-all ${
                            r.openTrades > 0 
                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                            : 'bg-[#00d09c] text-white hover:bg-[#00b085] shadow-sm hover:shadow-md active:scale-95'
                          }`}
                          title={r.openTrades > 0 ? "Cannot settle with open trades" : "Run Settlement"}
                        >
                          {busyStrategyId === r.strategyId ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <FiPlayCircle className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
