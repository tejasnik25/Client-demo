"use client";

import { useEffect, useMemo, useState } from "react";
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

const BillingPage: React.FC = () => {
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

  return (
    <UserLayout>
      <div className="min-h-screen bg-[#0f1527] text-white px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Billing Information</h1>
            <p className="text-sm text-gray-400">All payment-related transactions</p>
          </div>
          <Link href="/strategies" className="px-4 py-2 rounded-lg bg-[#1a1f2e] border border-[#283046] hover:bg-[#1f243a]">Back to Strategies</Link>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          {[
            { k: 'all', label: 'All' },
            { k: 'successful', label: 'Successful' },
            { k: 'rejected', label: 'Rejected' },
            { k: 'pending', label: 'Pending' },
          ].map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setFilter(k as any)}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${filter === k ? 'bg-gradient-to-r from-[#7c3aed] to-[#a855f7]' : 'bg-[#1a1f2e] border border-[#283046] text-gray-300 hover:bg-[#1f243a]'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Table/List */}
        <div className="bg-[#161d31] border border-[#283046] rounded-2xl overflow-hidden">
          <div className="grid grid-cols-6 gap-3 px-6 py-3 text-sm text-gray-300 border-b border-[#283046]">
            <div>Payment Id</div>
            <div>Status</div>
            <div>Type</div>
            <div>Amount (₹)</div>
            <div>Plan</div>
            <div>Actions</div>
          </div>

          {loading ? (
            <div className="p-6 text-gray-400">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-gray-400">No transactions found.</div>
          ) : (
            filtered.map(tx => (
              <div key={tx.id} className="grid grid-cols-6 gap-3 px-6 py-4 border-b border-[#283046] text-sm">
                <div className="truncate">{tx.id}</div>
                <div>
                  {tx.status === 'completed' && <span className="text-[#28c76f]">Successful</span>}
                  {tx.status === 'failed' && <span className="text-red-400">Rejected</span>}
                  {(tx.status === 'pending' || tx.status === 'in-process' || tx.status === 'in_process') && <span className="text-yellow-300">Pending</span>}
                  {tx.rejection_reason && (
                    <div className="text-xs text-gray-400 mt-1">Reason: {tx.rejection_reason}</div>
                  )}
                  {tx.admin_message && (
                    <div className="text-xs text-gray-400 mt-1">Message: {tx.admin_message} {tx.admin_message_status ? `(${tx.admin_message_status})` : ''}</div>
                  )}
                </div>
                <div className="capitalize">{tx.transaction_type}</div>
                <div>{(tx.inr_amount ?? tx.amount)?.toLocaleString()}</div>
                <div>{tx.plan_level ?? '—'}</div>
                <div className="flex gap-2">
                  {tx.status === 'failed' && (
                    <Link
                      href={`/wallet/topup?method=QR&amount=${encodeURIComponent(String(tx.inr_amount ?? tx.amount))}`}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#7c3aed] to-[#a855f7] text-white"
                    >
                      Retry Payment
                    </Link>
                  )}
                  <Link
                    href={`/contact?tx=${encodeURIComponent(tx.id)}`}
                    className="px-3 py-1.5 rounded-lg border border-[#283046] bg-[#1a1f2e] hover:bg-[#1f243a]"
                  >
                    Contact Us
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </UserLayout>
  );
};

export default BillingPage;