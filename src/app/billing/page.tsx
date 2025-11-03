"use client";

import { useEffect, useMemo, useState } from "react";
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
  status: 'pending' | 'completed' | 'failed';
  inr_amount?: number;
  plan_level?: 'Premium' | 'Expert' | 'Pro';
  strategy_id?: string;
  rejection_reason?: string;
  created_at: string;
};

const BillingPage: React.FC = () => {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'successful' | 'rejected' | 'pending'>('all');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/wallet/transactions');
        const data = await res.json();
        const list: Tx[] = data?.transactions || [];
        setTxs(list);
      } catch {
        setTxs([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const mine = useMemo(() => (user ? txs.filter(t => t.user_id === user.id) : []), [txs, user]);
  
  const exportToExcel = () => {
    const exportData = filtered.map(tx => ({
      'Transaction ID': tx.id,
      'Payment ID': tx.transaction_id || 'N/A',
      'Status': tx.status === 'completed' ? 'Successful' : tx.status === 'failed' ? 'Failed' : 'Pending',
      'Type': tx.transaction_type,
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
        return mine.filter(t => t.status === 'completed');
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
    const successful = mine.filter(t => t.status === 'completed');
    const pending = mine.filter(t => t.status === 'pending');
    const failed = mine.filter(t => t.status === 'failed');
    
    const totalSpent = successful.reduce((sum, t) => sum + (t.inr_amount ?? t.amount), 0);
    const pendingAmount = pending.reduce((sum, t) => sum + (t.inr_amount ?? t.amount), 0);
    
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
        return 'text-[#00d09c] bg-[#00d09c]/10';
      case 'failed':
        return 'text-red-400 bg-red-400/10';
      case 'pending':
        return 'text-yellow-400 bg-yellow-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  return (
    <UserLayout>
      <div className="min-h-screen bg-[#0e1726] text-white p-6">
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
              <p className="text-gray-400">Manage your transactions and payment history</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-[#1b2e4b] to-[#0e1726] border border-[#2d4a6b]/30 rounded-2xl p-6 fx-3d-card">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-[#00d09c]/20">
                <FiDollarSign className="h-5 w-5 text-[#00d09c]" />
              </div>
              <span className="text-xs text-gray-400 uppercase tracking-wider">Total Spent</span>
            </div>
            <div className="text-2xl font-bold text-white">₹{stats.totalSpent.toLocaleString()}</div>
            <div className="text-sm text-gray-400 mt-1">{stats.successful} successful payments</div>
          </div>

          <div className="bg-gradient-to-br from-[#1b2e4b] to-[#0e1726] border border-[#2d4a6b]/30 rounded-2xl p-6 fx-3d-card">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-yellow-400/20">
                <FiClock className="h-5 w-5 text-yellow-400" />
              </div>
              <span className="text-xs text-gray-400 uppercase tracking-wider">Pending</span>
            </div>
            <div className="text-2xl font-bold text-white">₹{stats.pendingAmount.toLocaleString()}</div>
            <div className="text-sm text-gray-400 mt-1">{stats.pending} pending payments</div>
          </div>

          <div className="bg-gradient-to-br from-[#1b2e4b] to-[#0e1726] border border-[#2d4a6b]/30 rounded-2xl p-6 fx-3d-card">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-red-400/20">
                <FiX className="h-5 w-5 text-red-400" />
              </div>
              <span className="text-xs text-gray-400 uppercase tracking-wider">Failed</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.failed}</div>
            <div className="text-sm text-gray-400 mt-1">Failed transactions</div>
          </div>

          <div className="bg-gradient-to-br from-[#1b2e4b] to-[#0e1726] border border-[#2d4a6b]/30 rounded-2xl p-6 fx-3d-card">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-[#7c3aed]/20">
                <FiTrendingUp className="h-5 w-5 text-[#7c3aed]" />
              </div>
              <span className="text-xs text-gray-400 uppercase tracking-wider">Total</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalTransactions}</div>
            <div className="text-sm text-gray-400 mt-1">All transactions</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          {[
            { k: 'all', label: 'All Transactions', count: stats.totalTransactions },
            { k: 'successful', label: 'Successful', count: stats.successful },
            { k: 'pending', label: 'Pending', count: stats.pending },
            { k: 'rejected', label: 'Failed', count: stats.failed },
          ].map(({ k, label, count }) => (
            <button
              key={k}
              onClick={() => setFilter(k as any)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 fx-3d-card ${
                filter === k 
                  ? 'bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white shadow-lg' 
                  : 'bg-[#1b2e4b] border border-[#2d4a6b]/30 text-gray-300 hover:bg-[#2d4a6b]/20'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {/* Transactions Table */}
        <div className="bg-gradient-to-br from-[#1b2e4b] to-[#0e1726] border border-[#2d4a6b]/30 rounded-2xl overflow-hidden fx-3d-card">
          <div className="p-6 border-b border-[#2d4a6b]/30">
            <h2 className="text-xl font-semibold text-white">Transaction History</h2>
            <p className="text-gray-400 text-sm mt-1">View and manage your payment transactions</p>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center gap-3 text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00d09c]"></div>
                Loading transactions...
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="p-4 rounded-full bg-gray-400/10 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FiCreditCard className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No transactions found</h3>
              <p className="text-gray-400 mb-6">You haven't made any {filter !== 'all' ? filter : ''} transactions yet.</p>
              <Link
                href="/strategies"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white font-medium hover:shadow-lg transition-all duration-200 fx-3d-card"
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
                  <div key={tx.id} className="rounded-2xl bg-[#121a2b] border border-[#2d4a6b]/30 p-4 fx-3d-card">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#2d4a6b]/20">
                          <FiCreditCard className="h-4 w-4 text-[#00d09c]" />
                        </div>
                        <div>
                          <div className="font-medium text-white text-sm">{tx.id.slice(0, 8)}...</div>
                          {tx.transaction_id && (
                            <div className="text-xs text-gray-400">ID: {tx.transaction_id.slice(0, 12)}...</div>
                          )}
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                        {tx.status === 'completed' ? 'Successful' : tx.status === 'failed' ? 'Failed' : 'Pending'}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-gray-400">Type</div>
                        <div className="capitalize text-white">{tx.transaction_type}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Amount</div>
                        <div className="font-semibold text-white">₹{(tx.inr_amount ?? tx.amount).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Plan</div>
                        <div>
                          {tx.plan_level ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#7c3aed]/20 text-[#7c3aed]">
                              {tx.plan_level}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Date</div>
                        <div className="flex items-center gap-2 text-white">
                          <FiCalendar className="h-3 w-3" />
                          <span className="text-sm">{new Date(tx.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2">
                      {tx.status === 'failed' && (
                        <Link
                          href={`/wallet/topup?method=QR&amount=${encodeURIComponent(String(tx.inr_amount ?? tx.amount))}`}
                          className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white text-sm font-medium hover:shadow-lg transition-all duration-200 fx-3d-card"
                        >
                          <FiRefreshCw className="h-4 w-4" />
                          Retry Payment
                        </Link>
                      )}
                      <button className="h-11 rounded-xl bg-[#2d4a6b]/20 text-gray-300 hover:text-white hover:bg-[#2d4a6b]/40 transition-colors">
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Table remains intact */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2d4a6b]/30">
                      <th className="text-left p-4 text-sm font-medium text-gray-400 uppercase tracking-wider">Transaction</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-400 uppercase tracking-wider">Type</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-400 uppercase tracking-wider">Plan</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((tx) => (
                      <tr key={tx.id} className="border-b border-[#2d4a6b]/20 hover:bg-[#2d4a6b]/10 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-[#2d4a6b]/20">
                              <FiCreditCard className="h-4 w-4 text-[#00d09c]" />
                            </div>
                            <div>
                              <div className="font-medium text-white text-sm">{tx.id.slice(0, 8)}...</div>
                              {tx.transaction_id && (
                                <div className="text-xs text-gray-400">ID: {tx.transaction_id.slice(0, 12)}...</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(tx.status)}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                              {tx.status === 'completed' ? 'Successful' : tx.status === 'failed' ? 'Failed' : 'Pending'}
                            </span>
                          </div>
                          {tx.status === 'failed' && tx.rejection_reason && (
                            <div className="text-xs text-red-400 mt-1">
                              {tx.rejection_reason}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="capitalize text-gray-300">{tx.transaction_type}</span>
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-white">₹{(tx.inr_amount ?? tx.amount).toLocaleString()}</div>
                        </td>
                        <td className="p-4">
                          {tx.plan_level ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#7c3aed]/20 text-[#7c3aed]">
                              {tx.plan_level}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-gray-300">
                            <FiCalendar className="h-3 w-3" />
                            <span className="text-sm">
                              {new Date(tx.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {tx.status === 'failed' && (
                              <Link
                                href={`/wallet/topup?method=QR&amount=${encodeURIComponent(String(tx.inr_amount ?? tx.amount))}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white text-xs font-medium hover:shadow-lg transition-all duration-200 fx-3d-card"
                              >
                                <FiRefreshCw className="h-3 w-3" />
                                Retry
                              </Link>
                            )}
                            <button className="p-1.5 rounded-lg bg-[#2d4a6b]/20 text-gray-400 hover:text-white hover:bg-[#2d4a6b]/40 transition-colors">
                              <FiEye className="h-3 w-3" />
                            </button>
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
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1b2e4b] border border-[#2d4a6b]/30 text-gray-300 font-medium hover:bg-[#2d4a6b]/20 transition-all duration-200 fx-3d-card"
          >
            <FiTrendingUp className="h-4 w-4" />
            Browse Strategies
          </Link>
          <button 
            onClick={exportToExcel}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1b2e4b] border border-[#2d4a6b]/30 text-gray-300 font-medium hover:bg-[#2d4a6b]/20 transition-all duration-200 fx-3d-card"
          >
            <FiDownload className="h-4 w-4" />
            Export History
          </button>
        </div>
      </div>
    </UserLayout>
  );
};

export default BillingPage;