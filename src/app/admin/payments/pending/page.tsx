'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FiCheckCircle, 
  FiXCircle, 
  FiClock, 
  FiAlertTriangle, 
  FiSend, 
  FiRefreshCw, 
  FiUser, 
  FiActivity, 
  FiDollarSign, 
  FiFileText,
  FiExternalLink
} from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { toast } from '@/components/ui/use-toast';

type Payment = {
  id: string;
  userId: string;
  userName?: string;
  strategyId: string;
  strategyName?: string;
  transactionType?: 'deposit' | 'charge';
  plan: string;
  capital: number;
  payable: number;
  method: string;
  txId: string;
  proofUrl: string;
  status: string;
  createdAt?: string;
  admin_message?: string;
  admin_message_status?: 'pending' | 'sent' | 'resolved';
};

type SectionCardProps = {
  title: string;
  icon: React.ReactNode;
  payments: Payment[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onMessage: (id: string) => void;
  busyId: string | null;
};

export default function PaymentsPendingPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);
  const [messageFor, setMessageFor] = useState<string | null>(null);
  const [reason, setReason] = useState<string>('');

  const loadData = async () => {
    try {
      const [res, sres] = await Promise.all([
        fetch('/api/admin/payments/pending', { cache: 'no-store' }),
        fetch('/api/strategies', { cache: 'no-store' })
      ]);
      
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.transactions ?? []);
        setPayments(items.map((t: any) => ({
          id: t.id,
          userId: t.user_id,
          userName: t.user?.name,
          strategyId: t.strategy_id,
          strategyName: t.strategy?.name,
          transactionType: t.transaction_type,
          plan: t.plan_level || t.plan,
          capital: t.capital ?? t.amount ?? 0,
          payable: t.amount,
          method: t.payment_method,
          txId: t.transaction_id,
          proofUrl: t.receipt_path,
          status: t.status,
          createdAt: t.created_at,
          admin_message: t.admin_message,
          admin_message_status: t.admin_message_status,
        })));
      }
      
      if (sres.ok) {
        const sdata = await sres.json();
        setStrategies(Array.isArray(sdata) ? sdata : (sdata.strategies || []));
      }
    } catch (e) {
      console.error('Failed to load pending payments:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-refresh disabled per user request
    // const interval = setInterval(loadData, 10000);
    // return () => clearInterval(interval);
  }, []);

  const pendingDeposits = useMemo(() => 
    payments.filter(p => p.transactionType === 'deposit'), [payments]);
  
  const pendingWithdrawals = useMemo(() => 
    payments.filter(p => p.transactionType === 'charge'), [payments]);

  const updateStatus = async (paymentId: string, status: 'approved' | 'rejected') => {
    try {
      let body: any = undefined;
      if (status === 'rejected') {
        const rejectionReason = window.prompt('Enter rejection reason');
        if (!rejectionReason || !rejectionReason.trim()) return;
        body = JSON.stringify({ rejectionReason });
      }

      setBusyPaymentId(paymentId);
      const endpoint = status === 'approved'
        ? `/api/admin/payments/${paymentId}/approve`
        : `/api/admin/payments/${paymentId}/reject`;
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      
      if (!res.ok) throw new Error('Failed to update payment');
      
      const result = await res.json();
      console.log('[Admin Payments] Approval result:', result);
      
      toast({
        title: 'Success',
        description: `Payment ${status} successfully`,
      });
      
      // Wait a moment for DB to settle, then reload
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadData();
    } catch (e: any) {
      console.error('[Admin Payments] Error:', e);
      toast({
        title: 'Error',
        description: e.message || 'Update failed',
        variant: 'destructive',
      });
    } finally {
      setBusyPaymentId(null);
    }
  };

  const sendMessage = async (paymentId: string) => {
    if (!reason.trim()) return;
    try {
      setBusyPaymentId(paymentId);
      const res = await fetch(`/api/admin/payments/${paymentId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reason })
      });
      if (!res.ok) throw new Error('Failed to send message');
      
      toast({ title: 'Success', description: 'Message sent to user' });
      setMessageFor(null);
      setReason('');
      await loadData();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message || 'Message failed',
        variant: 'destructive',
      });
    } finally {
      setBusyPaymentId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-[#00d09c]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Pending Payments</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Review and verify deposit and withdrawal requests</p>
        </div>
        <Button 
          variant="outline" 
          onClick={loadData} 
          className="bg-white border-gray-200 hover:bg-gray-50 flex items-center gap-2 h-11 px-6 rounded-xl font-bold"
        >
          <FiRefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Deposits Section */}
      <SectionCard 
        title="Deposit Requests" 
        icon={<FiDollarSign className="text-green-500" />}
        payments={pendingDeposits}
        onApprove={(id: string) => updateStatus(id, 'approved')}
        onReject={(id: string) => updateStatus(id, 'rejected')}
        onMessage={(id: string) => setMessageFor(id)}
        busyId={busyPaymentId}
      />

      {/* Withdrawals Section */}
      <SectionCard 
        title="Withdrawal Requests" 
        icon={<FiActivity className="text-blue-500" />}
        payments={pendingWithdrawals}
        onApprove={(id: string) => updateStatus(id, 'approved')}
        onReject={(id: string) => updateStatus(id, 'rejected')}
        onMessage={(id: string) => setMessageFor(id)}
        busyId={busyPaymentId}
      />

      {/* Message Modal Overlay */}
      {messageFor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <CardHeader className="p-8 border-b border-gray-50">
              <CardTitle className="text-xl font-black text-gray-900 uppercase">Send Admin Message</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reason for holding payment</label>
                <textarea
                  className="w-full p-4 rounded-xl bg-gray-50 border border-gray-100 text-sm font-medium focus:border-[#00d09c] outline-none transition-all"
                  rows={4}
                  placeholder="e.g., Incorrect transaction ID, proof image not clear..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => { setMessageFor(null); setReason(''); }}
                  className="flex-1 h-12 rounded-xl font-bold border-gray-200"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => sendMessage(messageFor)}
                  disabled={!reason.trim() || busyPaymentId === messageFor}
                  className="flex-1 h-12 bg-[#00d09c] hover:bg-[#00b085] text-white rounded-xl font-black uppercase tracking-widest text-xs"
                >
                  {busyPaymentId === messageFor ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, icon, payments, onApprove, onReject, onMessage, busyId }: SectionCardProps) {
  return (
    <Card className="bg-white border-gray-100 shadow-sm rounded-[2rem] overflow-hidden">
      <CardHeader className="p-8 border-b border-gray-50 flex flex-row items-center gap-4">
        <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">{icon}</div>
        <CardTitle className="text-xl font-black text-gray-900 uppercase tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          {/* Mobile View: List */}
          <div className="md:hidden divide-y divide-gray-50">
            {payments.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">No pending requests</div>
            ) : payments.map((p: any) => (
              <div key={p.id} className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-black text-gray-900">{p.userName || 'Anonymous'}</h4>
                    <p className="text-[10px] font-bold text-gray-400">{p.userId}</p>
                  </div>
                  <span className="text-sm font-black text-[#00d09c]">${Number(p.payable).toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-[10px]">
                  <p className="font-bold text-gray-400 uppercase">Strategy: <span className="text-gray-900">{p.strategyName || '—'}</span></p>
                  <p className="font-bold text-gray-400 uppercase">Method: <span className="text-gray-900">{p.method}</span></p>
                  <p className="font-bold text-gray-400 uppercase">Plan: <span className="text-gray-900">{p.plan}</span></p>
                  <p className="font-bold text-gray-400 uppercase">Proof: 
                    {p.proofUrl ? (
                      <a href={p.proofUrl} target="_blank" rel="noreferrer" className="ml-1 text-blue-500 font-black uppercase">View <FiExternalLink className="inline h-2 w-2" /></a>
                    ) : <span className="text-gray-900 ml-1">—</span>}
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={() => onApprove(p.id)} className="flex-1 h-9 bg-[#00d09c] hover:bg-[#00b085] text-white text-[10px] font-black uppercase tracking-widest">Approve</Button>
                  <Button onClick={() => onReject(p.id)} className="flex-1 h-9 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest">Reject</Button>
                  <Button variant="outline" onClick={() => onMessage(p.id)} className="h-9 w-10 flex items-center justify-center border-gray-200"><FiSend className="w-4 h-4 text-blue-500" /></Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View: Table */}
          <table className="hidden md:table w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                <th className="px-8 py-4">User Details</th>
                <th className="px-8 py-4">Strategy / Plan</th>
                <th className="px-8 py-4 text-right">Amount</th>
                <th className="px-8 py-4">Method / TXID</th>
                <th className="px-8 py-4 text-center">Proof</th>
                <th className="px-8 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">No pending requests</td>
                </tr>
              ) : payments.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-gray-900">{p.userName || 'Anonymous'}</span>
                      <span className="text-[10px] font-bold text-gray-400">{p.userId}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-700">{p.strategyName || '—'}</span>
                      <span className="text-[10px] font-black text-[#00d09c] uppercase tracking-tighter">{p.plan}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className="text-sm font-black text-gray-900">${Number(p.payable).toFixed(2)}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-700">{p.method}</span>
                      <span className="text-[10px] font-mono text-gray-400 truncate max-w-[120px]" title={p.txId}>{p.txId}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    {p.proofUrl ? (
                      <a 
                        href={p.proofUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-blue-100 transition-colors"
                      >
                        View <FiFileText className="w-3 h-3" />
                      </a>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => onApprove(p.id)} 
                        disabled={busyId === p.id}
                        className="p-2.5 bg-green-50 text-green-600 rounded-xl border border-green-100 hover:bg-[#00d09c] hover:text-white transition-all shadow-sm"
                        title="Approve Payment"
                      >
                        <FiCheckCircle className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onReject(p.id)} 
                        disabled={busyId === p.id}
                        className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                        title="Reject Payment"
                      >
                        <FiXCircle className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onMessage(p.id)} 
                        disabled={busyId === p.id}
                        className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                        title="Send Message"
                      >
                        <FiSend className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
