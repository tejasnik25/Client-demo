"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import UserLayout from "@/components/UserLayout";
import { useAuth } from "@/hooks/use-auth";
import { FiCreditCard, FiDollarSign, FiTrendingUp, FiCalendar, FiCheck, FiX, FiClock, FiRefreshCw, FiDownload, FiEye } from "react-icons/fi";
import * as XLSX from 'xlsx';

type Tx = {
  id: string;
  user_id: string;
  amount: number; 
  transaction_type: 'deposit' | 'charge';
  payment_method?: string;
  transaction_id?: string;
  status: 'pending' | 'completed' | 'failed' | 'approved';
  inr_amount?: number;
  plan_level?: 'Premium' | 'Expert' | 'Pro';
  strategy_id?: string;
  rejection_reason?: string;
  created_at: string;
};

const BillingPageInner: React.FC = () => {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [totalDeposited, setTotalDeposited] = useState<number>(0);
  const [totalCharged, setTotalCharged] = useState<number>(0);
  const [strategies, setStrategies] = useState<{ id: string; name: string; enabled?: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'successful' | 'rejected' | 'pending'>('all');
  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatUSD = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [txRes, stratRes] = await Promise.all([
          fetch('/api/wallet/transactions', { cache: 'no-store' }),
          fetch('/api/strategies', { cache: 'no-store' })
        ]);
        const txData = await txRes.json();
        const stratData = await stratRes.json();
        const list: Tx[] = txData?.transactions || [];
        setTxs(list);
        setBalance(txData?.balance || 0);
        setTotalDeposited(Number(txData?.total_deposited ?? list.filter((t) => t.transaction_type === 'deposit' && ['completed','approved','settled'].includes(t.status)).reduce((sum, t) => sum + Number(t.amount ?? 0), 0)));
        setTotalCharged(Number(txData?.total_charged ?? list.filter((t) => t.transaction_type === 'charge' && ['completed','approved','settled'].includes(t.status)).reduce((sum, t) => sum + Number(t.amount ?? 0), 0)));
        const fetched = (stratData?.strategies || []).map((s: { id?: string | number; name?: string; enabled?: boolean }) => ({ id: String(s.id ?? ''), name: String(s.name ?? ''), enabled: s.enabled !== false }));
        setStrategies(fetched.filter((s: { enabled?: boolean }) => s.enabled !== false));
      } catch {
        setTxs([]);
        setStrategies([]);
        setBalance(0);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const mine = useMemo(() => txs, [txs]);
  
  const strategyMap = useMemo(() => {
    const map = new Map<string, string>();
    strategies.forEach(s => map.set(s.id, s.name));
    return map;
  }, [strategies]);
  
  const exportToExcel = () => {
    const exportData = filtered.map(tx => ({
      'Transaction ID': tx.id,
      'Payment ID': tx.transaction_id || 'N/A',
      'Status': (tx.status === 'completed' || tx.status === 'approved') ? 'Successful' : tx.status === 'failed' ? 'Failed' : 'Pending',
      'Strategy': strategyMap.get(tx.strategy_id || '') || 'N/A',
      'Amount (₹)': tx.inr_amount ?? tx.amount,
      'Plan': tx.plan_level || 'N/A',
      'Payment Method': tx.payment_method || 'N/A',
      'Date': new Date(tx.created_at).toLocaleDateString(),
      'Rejection Reason': tx.rejection_reason || 'N/A'
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    
    const fileName = `transactions_${filter}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };
  
  const filtered = useMemo(() => {
    switch (filter) {
      case 'successful':
        return mine.filter(t => t.status === 'completed' || t.status === 'approved');
      case 'rejected':
        return mine.filter(t => t.status === 'failed');
      case 'pending':
        return mine.filter(t => t.status === 'pending');
      default:
        return mine;
    }
  }, [mine, filter]);

  // Calculate stats
  const stats = useMemo(() => {
    const successful = mine.filter(t => t.status === 'completed' || t.status === 'approved');
    const pending = mine.filter(t => t.status === 'pending');
    const failed = mine.filter(t => t.status === 'failed');
    
    const totalSpent = successful.reduce((sum, t) => sum + Number(t.inr_amount ?? t.amount), 0);
    const pendingAmount = pending.reduce((sum, t) => sum + Number(t.inr_amount ?? t.amount), 0);
    
    return {
      totalTransactions: mine.length,
      successful: successful.length,
      pending: pending.length,
      failed: failed.length,
      totalSpent,
      pendingAmount
    };
  }, [mine]);


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return <FiCheck className="h-4 w-4 text-[#00d09c]" />;
      case 'failed':
        return <FiX className="h-4 w-4 text-red-400" />;
      case 'pending':
        return <FiClock className="h-4 w-4 text-yellow-400" />;
      default:
        return <FiClock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'text-green-700 bg-green-100';
      case 'failed':
        return 'text-red-700 bg-red-100';
      case 'pending':
        return 'text-yellow-700 bg-yellow-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  return (
    <UserLayout>
      <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-gradient-to-r from-[#00d09c]/20 to-[#7c3aed]/20 fx-3d-card">
              <FiCreditCard className="h-6 w-6 text-[#00d09c]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#00d09c] to-[#7c3aed] bg-clip-text text-transparent">
                Billing & Payments
              </h1>
              <p className="text-gray-600">Manage your transactions and payment history</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-[#00d09c] to-[#7c3aed] rounded-2xl p-6 shadow-lg text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-white/20">
                <FiDollarSign className="h-5 w-5 text-white" />
              </div>
              <span className="text-xs text-white/80 uppercase tracking-wider">Central Wallet Balance</span>
            </div>
            <div className="text-3xl font-black">{formatUSD(balance)}</div>
            <div className="text-sm text-white/70 mt-1">Available funds for trading</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-green-100">
                <FiTrendingUp className="h-5 w-5 text-[#00d09c]" />
              </div>
              <span className="text-xs text-gray-600 uppercase tracking-wider">Total Deposited</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatINR(totalDeposited)}</div>
            <div className="text-sm text-gray-600 mt-1">Completed deposit amount</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-yellow-100">
                <FiClock className="h-5 w-5 text-yellow-600" />
              </div>
              <span className="text-xs text-gray-600 uppercase tracking-wider">Reserved / Charges</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatINR(totalCharged)}</div>
            <div className="text-sm text-gray-600 mt-1">Capital reserved for strategies</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-red-100">
                <FiX className="h-5 w-5 text-red-600" />
              </div>
              <span className="text-xs text-gray-600 uppercase tracking-wider">Failed</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.failed}</div>
            <div className="text-sm text-gray-600 mt-1">Failed transactions</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-purple-100">
                <FiTrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-xs text-gray-600 uppercase tracking-wider">Total</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalTransactions}</div>
            <div className="text-sm text-gray-600 mt-1">All wallet transactions with statuses</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          {([
            { k: 'all', label: 'All Transactions', count: stats.totalTransactions },
            { k: 'successful', label: 'Successful', count: stats.successful },
            { k: 'pending', label: 'Pending', count: stats.pending },
            { k: 'rejected', label: 'Failed', count: stats.failed },
          ] as Array<{ k: 'all' | 'successful' | 'rejected' | 'pending'; label: string; count: number }>).map(({ k, label, count }) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                filter === k 
                  ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] text-white shadow-lg' 
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {totalDeposited > 0 && balance === 0 && totalCharged > 0 && (
          <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
            Your deposit payment has been approved, but an equal strategy charge has been applied to reserve capital. The transaction history below still shows the deposit and charge records.
          </div>
        )}

        {/* Transactions Table */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Transaction History</h2>
            <p className="text-gray-600 text-sm mt-1">View and manage your payment transactions</p>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center gap-3 text-gray-600">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00d09c]"></div>
                Loading transactions...
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="p-4 rounded-full bg-gray-100 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FiCreditCard className="h-8 w-8 text-gray-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
              <p className="text-gray-600 mb-6">You haven't made any wallet transactions yet.</p>
              <Link
                href="/strategies"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] text-white font-medium hover:shadow-lg transition-all duration-200"
              >
                <FiTrendingUp className="h-4 w-4" />
                Explore Strategies
              </Link>
            </div>
          ) : (
            <>
              {/* Mobile: Stacked transaction cards */}
              <div className="md:hidden space-y-3 p-3">
                {filtered.map((tx) => (
                  <div key={tx.id} className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-100">
                          <FiCreditCard className="h-4 w-4 text-[#00d09c]" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{tx.id.slice(0, 8)}...</div>
                          {tx.transaction_id && (
                            <div className="text-xs text-gray-600">ID: {tx.transaction_id.slice(0, 12)}...</div>
                          )}
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                        {(tx.status === 'completed' || tx.status === 'approved') ? 'Successful' : tx.status === 'failed' ? 'Failed' : 'Pending'}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-gray-600">Strategy</div>
                        <div className="text-gray-900">{strategyMap.get(tx.strategy_id || '') || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Amount</div>
                        <div className="font-semibold text-gray-900">{formatINR(Number(tx.inr_amount ?? tx.amount))}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Plan</div>
                        <div>
                          {tx.plan_level ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              {tx.plan_level}
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">Date</div>
                        <div className="flex items-center gap-2 text-gray-900">
                          <FiCalendar className="h-3 w-3" />
                          <span className="text-sm">{new Date(tx.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    
                  </div>
                ))}
              </div>

              {/* Desktop: Table remains intact */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left p-4 text-sm font-medium text-gray-700 uppercase tracking-wider">Transaction</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-700 uppercase tracking-wider">Strategy</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-700 uppercase tracking-wider">Amount</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-700 uppercase tracking-wider">Plan</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-700 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((tx) => (
                      <tr key={tx.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100">
                              <FiCreditCard className="h-4 w-4 text-[#00d09c]" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 text-sm">{tx.id.slice(0, 8)}...</div>
                              {tx.transaction_id && (
                                <div className="text-xs text-gray-600">ID: {tx.transaction_id.slice(0, 12)}...</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(tx.status)}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                              {(tx.status === 'completed' || tx.status === 'approved') ? 'Successful' : tx.status === 'failed' ? 'Failed' : 'Pending'}
                            </span>
                          </div>
                          {tx.status === 'failed' && tx.rejection_reason && (
                            <div className="text-xs text-red-600 mt-1">
                              {tx.rejection_reason}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="text-gray-900">{strategyMap.get(tx.strategy_id || '') || 'N/A'}</span>
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-gray-900">{formatINR(Number(tx.inr_amount ?? tx.amount))}</div>
                        </td>
                        <td className="p-4">
                          {tx.plan_level ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              {tx.plan_level}
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-gray-900">
                            <FiCalendar className="h-3 w-3" />
                            <span className="text-sm">
                              {new Date(tx.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 flex flex-wrap gap-4">
          
          <Link
            href="/strategies"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] text-white font-medium transition-all duration-200"
          >
            <FiTrendingUp className="h-4 w-4" />
            Browse Strategies
          </Link>
          <button 
            onClick={exportToExcel}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] text-white font-medium transition-all duration-200"
          >
            <FiDownload className="h-4 w-4" />
            Export History
          </button>
        </div>
      </div>
    </UserLayout>
  );
};

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-900">Loading billing...</div>}>
      <BillingPageInner />
    </Suspense>
  );
}
