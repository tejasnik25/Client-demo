"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import '../../../../styles/themes.css';

type Payment = {
  id: string;
  userId: string;
  userName?: string;
  strategyId: string;
  strategyName?: string;
  plan: string;
  capital: number;
  payable: number;
  method: string;
  txId: string;
  proofUrl: string;
  status: string;
  createdAt?: string;
  approvedAt?: string;
  expiresAt?: string;
  verifiedBy?: string;
  admin_message?: string;
  admin_message_status?: 'pending' | 'sent' | 'resolved';
};

const PaymentsPendingPage = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageFor, setMessageFor] = useState<string | null>(null);
  const [reason, setReason] = useState<string>('');

  const load = async () => {
    try {
      // Use admin API that returns hydrated transactions
      const res = await fetch('/api/admin/payments/pending', { cache: 'no-store', credentials: 'include' });
      if (!res.ok) {
        // Gracefully handle API failure: keep table visible with no rows
        setPayments([]);
        setError('Failed to load payments');
        return;
      }
      const data = await res.json();
      // Normalize to expected client shape
      const items = Array.isArray(data) ? data : (data.transactions ?? []);
      setPayments(items.map((t: any) => ({
        id: t.id,
        userId: t.user_id,
        userName: t.user?.name,
        strategyId: t.strategy_id,
        strategyName: t.strategy?.name,
        plan: t.plan_level || t.plan,
        capital: t.capital ?? t.amount ?? 0,
        payable: t.amount,
        method: t.payment_method,
        txId: t.transaction_id,
        proofUrl: t.receipt_path,
        status: t.status,
        createdAt: t.created_at,
        approvedAt: undefined,
        expiresAt: undefined,
        verifiedBy: undefined,
        admin_message: t.admin_message,
        admin_message_status: t.admin_message_status,
      })));
      setError(null);
    } catch (e) {
      // Network or parsing error: show empty table but keep UI intact
      setPayments([]);
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      load();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const pending = useMemo(() => payments.filter(p => ['pending','in_process','in-process'].includes(p.status)), [payments]);

  const updateStatus = async (paymentId: string, status: 'approved' | 'rejected') => {
    try {
      // Call explicit approve/reject admin endpoints
      const endpoint = status === 'approved'
        ? `/api/admin/payments/${paymentId}/approve`
        : `/api/admin/payments/${paymentId}/reject`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: status === 'rejected' ? JSON.stringify({ rejectionReason: reason || undefined }) : undefined,
      });
      if (!res.ok) throw new Error('Failed to update payment');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const sendMessage = async (paymentId: string) => {
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ message: reason || 'Additional information required' })
      });
      if (!res.ok) throw new Error('Failed to send message');
      setMessageFor(null);
      setReason('');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Message failed');
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Payments — Pending</h1>
      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700 border border-red-300">
          {error} — showing table with no values. <button className="underline ml-1" onClick={() => { setLoading(true); setError(null); load(); }}>Retry</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">user_id</th>
              <th className="p-2">Transaction ID</th>
              <th className="p-2">User Name</th>
              <th className="p-2">Strategy</th>
              <th className="p-2">Plan</th>
              <th className="p-2">Entered Amount</th>
              <th className="p-2">Paid Amount</th>
              <th className="p-2">Payment Method</th>
              <th className="p-2">Proof</th>
              <th className="p-2">Admin Message</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-4 text-center text-gray-500">No pending payments</td>
              </tr>
            ) : pending.map(p => (
              <tr key={p.id} className="border-b">
                <td className="p-2">{p.userId}</td>
                <td className="p-2">{p.txId}</td>
                <td className="p-2">{p.userName ?? '-'}</td>
                <td className="p-2">{p.strategyName ?? '-'}</td>
                <td className="p-2">{p.plan}</td>
                <td className="p-2">{p.capital}</td>
                <td className="p-2">{p.payable}</td>
                <td className="p-2">{p.method}</td>
                <td className="p-2">
                  {p.proofUrl ? (
                    <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-blue-600">View</a>
                  ) : '-'}
                </td>
                <td className="p-2">
                  { (p as any).admin_message ? (
                    <span title={(p as any).admin_message} className="text-gray-700 dark:text-gray-300">
                      {((p as any).admin_message as string).length > 28 ? ((p as any).admin_message as string).slice(0, 28) + '…' : (p as any).admin_message}
                      { (p as any).admin_message_status ? ` (${(p as any).admin_message_status})` : ''}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="p-2 space-x-2">
                  <button onClick={() => updateStatus(p.id, 'approved')} className="px-3 py-1 rounded bg-green-600 text-white">Approve</button>
                  <button onClick={() => updateStatus(p.id, 'rejected')} className="px-3 py-1 rounded bg-red-600 text-white">Reject</button>
                  <button onClick={() => setMessageFor(p.id)} className="px-3 py-1 rounded bg-yellow-500 text-white">Send Message</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {messageFor && (
          <div className="mt-4 p-4 border rounded bg-yellow-50 dark:bg-yellow-900/20">
            <h2 className="font-semibold mb-2">Reason for Holding Payment</h2>
            <textarea
              className="w-full p-2 border rounded bg-white dark:bg-gray-800"
              rows={3}
              placeholder="e.g., Incorrect transaction ID"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="mt-2 space-x-2">
              <button onClick={() => sendMessage(messageFor)} className="px-3 py-1 rounded bg-blue-600 text-white">Send</button>
              <button onClick={() => { setMessageFor(null); setReason(''); }} className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PendingPaymentsPage = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    action: '',
    paymentId: '',
    message: '',
  });

  const fetchPayments = async () => {
    try {
      const response = await fetch('/api/payments');
      const data = await response.json();
      if (response.ok) {
        setPayments(data.payments);
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to load payments');
      }
    } catch (err: any) {
      setError(err.message);
      setPayments([]); // Ensure table renders on failure
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    const interval = setInterval(fetchPayments, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = (action: string, paymentId: string) => {
    setModalConfig({ action, paymentId, message: '' });
    setShowModal(true);
  };

  const handleModalSubmit = async () => {
    const { action, paymentId, message } = modalConfig;
    try {
      let response: Response | null = null;
      if (action === 'approve') {
        response = await fetch(`/api/admin/payments/${paymentId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      } else if (action === 'reject') {
        response = await fetch(`/api/admin/payments/${paymentId}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rejectionReason: message }) });
      } else if (action === 'message') {
        response = await fetch(`/api/admin/payments/${paymentId}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
      }
      if (!response || !response.ok) {
        throw new Error('Failed to update payment');
      }
      await fetchPayments();
    } catch (error) {
      console.error(error);
    } finally {
      setShowModal(false);
    }
  };

  const pending = payments.filter(
    (p) => p.status === 'pending' || p.status === 'in_process'
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'renewal_approved':
        return <span className="status-badge status-completed">Completed</span>;
      case 'pending':
      case 'in_process':
        return <span className="status-badge status-pending">Pending</span>;
      case 'failed':
      case 'rejected':
        return <span className="status-badge status-failed">Failed</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gray-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Pending Transactions</h1>
        <button
          onClick={fetchPayments}
          className="flex items-center px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700"
        >
          <ArrowPathIcon className="h-5 w-5 mr-2" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500 text-white p-4 rounded-lg mb-4 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={fetchPayments} className="font-bold">
            Retry
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full payments-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>User</th>
              <th>Email</th>
              <th>Amount ($)</th>
              <th>Payment Method</th>
              <th>Platform</th>
              <th>Terms</th>
              <th>Status</th>
              <th>Submitted At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="text-center py-4">
                  Loading...
                </td>
              </tr>
            ) : pending.length > 0 ? (
              pending.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.txId}</td>
                  <td>{payment.userId}</td>
                  <td>{payment.userId}</td>
                  <td>${payment.payable.toFixed(2)}</td>
                  <td>{payment.method}</td>
                  <td>{payment.mt4mt5 ? JSON.parse(payment.mt4mt5).type : 'N/A'}</td>
                  <td>Accepted</td>
                  <td>{getStatusBadge(payment.status)}</td>
                  <td>
                    {new Date(payment.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </td>
                  <td className="flex space-x-2">
                    <button
                      onClick={() => handleAction('approve', payment.id)}
                      className="p-2 bg-green-600 rounded-full hover:bg-green-500"
                      title="Approve"
                    >
                      <CheckCircleIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleAction('reject', payment.id)}
                      className="p-2 bg-red-600 rounded-full hover:bg-red-500"
                      title="Reject"
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleAction('message', payment.id)}
                      className="p-2 bg-blue-600 rounded-full hover:bg-blue-500"
                      title="Send Message"
                    >
                      <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="text-center py-4 text-gray-500">
                  No pending payments available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 capitalize">
              {modalConfig.action} Payment
            </h2>
            {(modalConfig.action === 'reject' || modalConfig.action === 'message') && (
              <div className="mb-4">
                <label htmlFor="message" className="block mb-2">
                  Reason
                </label>
                <textarea
                  id="message"
                  value={modalConfig.message}
                  onChange={(e) =>
                    setModalConfig({ ...modalConfig, message: e.target.value })
                  }
                  className="w-full p-2 bg-gray-700 rounded-lg"
                  rows={4}
                ></textarea>
              </div>
            )}
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSubmit}
                className="px-4 py-2 bg-blue-600 rounded-lg"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Replace legacy component with the admin-hydrated version above
export default PaymentsPendingPage;