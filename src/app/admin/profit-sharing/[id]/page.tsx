'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { FiArrowLeft, FiDownload, FiPlayCircle, FiUsers, FiDollarSign, FiTrendingUp, FiCalendar, FiActivity } from 'react-icons/fi';
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

export default function StrategySettlementDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [strategy, setStrategy] = useState<StrategySettlementRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/admin/profit-sharing?strategyId=${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load strategy data');
      setStrategy(json.strategy);
    } catch (e: any) {
      setError(e?.message || 'Failed to load strategy data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

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

  const runSettlement = async () => {
    if (!strategy) return;
    try {
      setBusy(true);
      const res = await fetch('/api/admin/profit-sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId: strategy.strategyId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Settlement failed');
      const items = Array.isArray(json?.items) ? json.items : [];
      exportStrategyExcel(strategy, items);
      await loadData();
      alert(`Settlement completed for "${strategy.strategyName}". Excel downloaded.`);
    } catch (e: any) {
      alert(e?.message || 'Failed to run settlement');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-md bg-red-50 text-red-700 px-4 py-3 mb-4">{error || 'Strategy not found'}</div>
        <Button onClick={() => router.push('/admin/profit-sharing')}>Back to Settlement</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/profit-sharing" className="p-2 hover:bg-white rounded-full transition-all border border-transparent hover:border-gray-200 text-gray-600">
            <FiArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">{strategy.strategyName}</h1>
            <p className="text-sm font-medium text-gray-500">Strategy Settlement Details & Analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="flex-1 md:flex-none h-11 px-6 rounded-xl font-bold border-gray-200 hover:bg-gray-50"
            onClick={() => exportStrategyExcel(strategy, [])}
          >
            <FiDownload className="mr-2" />
            Excel Export
          </Button>
          <Button
            className="flex-1 md:flex-none h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest bg-[#00d09c] hover:bg-[#00b085] text-white shadow-sm"
            disabled={busy || strategy.openTrades > 0}
            onClick={runSettlement}
          >
            {busy ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <FiPlayCircle className="mr-2 w-4 h-4" />
                Run Settlement
              </>
            )}
          </Button>
        </div>
      </div>

      {strategy.openTrades > 0 && (
        <div className="rounded-2xl bg-orange-50 border border-orange-100 p-4 flex items-start gap-3">
          <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
            <FiActivity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-orange-800">Settlement Blocked</p>
            <p className="text-xs text-orange-600 mt-0.5">
              This strategy currently has <strong>{strategy.openTrades}</strong> open trades. All trades must be closed before running a profit-sharing settlement.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          icon={<FiUsers />} 
          label="Active Copiers" 
          value={strategy.copiersCount.toString()} 
          color="blue"
        />
        <StatCard 
          icon={<FiDollarSign />} 
          label="Total Deposits" 
          value={`$${strategy.totalDeposit.toLocaleString()}`} 
          color="green"
        />
        <StatCard 
          icon={<FiTrendingUp />} 
          label="Gross Profit" 
          value={`$${strategy.totalProfit.toLocaleString()}`} 
          color={strategy.totalProfit >= 0 ? "green" : "red"}
        />
        <StatCard 
          icon={<FiCalendar />} 
          label="Last Settlement" 
          value={strategy.lastSettlementAt ? new Date(strategy.lastSettlementAt).toLocaleDateString() : 'Never'} 
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900">Strategy Overview</h3>
              <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-black uppercase tracking-wider text-gray-500">
                Created: {new Date(strategy.strategyCreatedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <DetailItem label="Commission Structure" value={`${strategy.commissionPercent.toFixed(1)}% Profit Share`} />
                  <DetailItem label="Strategy ID" value={strategy.strategyId} />
                  <DetailItem label="Master Account" value={strategy.strategyId.includes('strategy_') ? 'MT5 Master' : 'Unknown'} />
                </div>
                <div className="space-y-6">
                  <DetailItem 
                    label="Current Status" 
                    value={strategy.openTrades > 0 ? "Active Trading" : "Idle"} 
                    valueColor={strategy.openTrades > 0 ? "text-orange-500" : "text-[#00d09c]"}
                  />
                  <DetailItem label="Total Swap Fees" value={`$${strategy.totalSwap.toFixed(2)}`} />
                  <DetailItem label="Open Positions" value={strategy.openTrades.toString()} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-[#00d09c] to-[#00b085] rounded-[2rem] p-8 text-white shadow-lg">
            <h3 className="text-lg font-black uppercase tracking-widest opacity-80 mb-6">Settlement Ready</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-white/20 pb-4">
                <span className="text-sm font-bold opacity-80">Payable Profit</span>
                <span className="text-3xl font-black">${strategy.totalProfit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-bold opacity-80">Admin Commission ({strategy.commissionPercent}%)</span>
                <span className="text-sm font-black">${(strategy.totalProfit * (strategy.commissionPercent / 100)).toLocaleString()}</span>
              </div>
            </div>
            <Button 
              className="w-full mt-8 h-12 bg-white text-[#00d09c] hover:bg-gray-50 rounded-xl font-black uppercase tracking-widest text-xs"
              disabled={busy || strategy.openTrades > 0}
              onClick={runSettlement}
            >
              Confirm & Settle
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) {
  const colorMap: any = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-green-600 border-green-100",
    red: "bg-red-50 text-red-600 border-red-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
  };

  return (
    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
      <div className={`w-12 h-12 rounded-2xl ${colorMap[color]} flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform border`}>
        {icon}
      </div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xl font-black text-gray-900 tracking-tight">{value}</p>
    </div>
  );
}

function DetailItem({ label, value, valueColor = "text-gray-900" }: { label: string, value: string, valueColor?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      <p className={`text-sm font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}
