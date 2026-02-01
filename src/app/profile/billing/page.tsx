"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import UserLayout from "@/components/UserLayout";
import { useAuth } from "@/hooks/use-auth";

type Tx = {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: 'deposit' | 'charge';
  payment_method?: string;
  transaction_id?: string;
  status: 'pending' | 'in-process' | 'in_process' | 'completed' | 'failed';
  inr_amount?: number;
  plan_level?: 'Premium' | 'Expert' | 'Pro';
  strategy_id?: string;
  rejection_reason?: string;
  admin_message?: string;
  admin_message_status?: 'pending' | 'sent' | 'resolved';
  created_at: string;
};

const BillingPageInner: React.FC = () => {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'successful' | 'rejected' | 'pending'>('all');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/wallet/transactions', { cache: 'no-store' });
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
  const filtered = useMemo(() => {
    switch (filter) {
      case 'successful':
        return mine.filter(t => t.status === 'completed');
      case 'rejected':
        return mine.filter(t => t.status === 'failed');
      case 'pending':
        return mine.filter(t => t.status === 'pending' || t.status === 'in-process' || t.status === 'in_process');
      default:
        return mine;
    }
  }, [mine, filter]);

  const formatINR = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalSpent = useMemo(() => {
    const successful = mine.filter(t => t.status === 'completed');
    return successful.reduce((sum, t) => sum + (t.inr_amount ?? t.amount), 0);
  }, [mine]);


  return (
    <UserLayout>
      <div className="min-h-screen bg-gray-50 text-gray-900 px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Billing Information</h1>
            <p className="text-sm text-gray-600">All payment-related transactions</p>
          </div>
          <Link href="/strategies" className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] text-white">Back to Strategies</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="text-xs text-gray-600 uppercase tracking-wider">Total Spent</div>
            <div className="text-xl font-bold text-gray-900 mt-1">{formatINR(totalSpent)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          {([
            { k: 'all', label: 'All' },
            { k: 'successful', label: 'Successful' },
            { k: 'rejected', label: 'Rejected' },
            { k: 'pending', label: 'Pending' },
          ] as Array<{ k: 'all' | 'successful' | 'rejected' | 'pending'; label: string }>).map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${filter === k ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Table/List */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-5 gap-3 px-6 py-3 text-sm text-gray-700 border-b border-gray-200 bg-gray-50 font-medium">
            <div>Payment Id</div>
            <div>Status</div>
            <div>Type</div>
            <div>Amount (₹)</div>
            <div>Plan</div>
          </div>

          {loading ? (
            <div className="p-6 text-gray-600">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-gray-600">No transactions found.</div>
          ) : (
            filtered.map(tx => (
              <div key={tx.id} className="grid grid-cols-5 gap-3 px-6 py-4 border-b border-gray-200 text-sm hover:bg-gray-50">
                <div className="truncate text-gray-900">{tx.id}</div>
                <div>
                  {tx.status === 'completed' && <span className="text-green-600">Successful</span>}
                  {tx.status === 'failed' && <span className="text-red-600">Rejected</span>}
                  {(tx.status === 'pending' || tx.status === 'in-process' || tx.status === 'in_process') && <span className="text-yellow-600">Pending</span>}
                  {tx.rejection_reason && (
                    <div className="text-xs text-gray-600 mt-1">Reason: {tx.rejection_reason}</div>
                  )}
                  {tx.admin_message && (
                    <div className="text-xs text-gray-600 mt-1">Message: {tx.admin_message} {tx.admin_message_status ? `(${tx.admin_message_status})` : ''}</div>
                  )}
                </div>
                <div className="capitalize text-gray-900">{tx.transaction_type}</div>
                <div className="text-gray-900">{(tx.inr_amount ?? tx.amount)?.toLocaleString()}</div>
                <div className="text-gray-900">{tx.plan_level ?? '—'}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </UserLayout>
  );
};

const BillingPage: React.FC = () => {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-900">Loading billing...</div>}>
      <BillingPageInner />
    </Suspense>
  );
};

export default BillingPage;
