'use client';
import React, { useState, useEffect } from 'react';
import { Bell, X, Check, AlertCircle, DollarSign, Plug, Key } from 'lucide-react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

interface PaymentNotification {
  id: string;
  type: 'payment';
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  receiptPath?: string;
  status: 'pending' | 'completed' | 'failed' | 'in-process';
  createdAt: string;
  isNew?: boolean;
}

interface ModificationNotification {
  id: string;
  type: 'modification';
  runningStrategyId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  strategyName?: string;
  summary: string;
  action: 'disconnect' | 'change-password' | 'change-account-id' | 'change-server' | 'change-platform' | 'other';
  createdAt?: string;
  isNew?: boolean;
}

interface PaymentNotificationsProps {
  className?: string;
}

const PaymentNotifications: React.FC<PaymentNotificationsProps> = ({ className }) => {
  const [notifications, setNotifications] = useState<Array<PaymentNotification | ModificationNotification>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch pending payments
  const fetchPendingPayments = async () => {
    try {
      const response = await fetch('/api/admin/payments/pending');
      if (response.ok) {
        const data = await response.json();
        const txs = Array.isArray(data) ? data : (data.transactions || []);
        const mapped: PaymentNotification[] = txs.map((t: any) => ({
          id: t.id,
          type: 'payment',
          userId: t.user_id,
          userName: t.user?.name || (t.userName || ''),
          userEmail: t.user?.email || (t.userEmail || ''),
          amount: Number(t.amount || 0),
          paymentMethod: t.payment_method || 'N/A',
          transactionId: t.transaction_id || '',
          receiptPath: t.receipt_path,
          status: t.status,
          createdAt: t.created_at || new Date().toISOString(),
          isNew: true,
        }));
        setNotifications(prev => {
          const others = prev.filter(n => (n as any).type !== 'payment');
          const existingIds = prev.map(n => n.id);
          const updated = mapped.map(m => ({ ...m, isNew: !existingIds.includes(m.id) }));
          const count = updated.filter(n => n.isNew).length + others.filter(n => (n as any).isNew).length;
          setUnreadCount(count);
          return [...updated, ...others];
        });
      }
    } catch (error) {
    }
  };

  const fetchModifications = async () => {
    try {
      const [modsRes, runsRes] = await Promise.all([
        fetch('/api/admin/running-strategies/modifications', { cache: 'no-store' }),
        fetch('/api/admin/running-strategies', { cache: 'no-store' }),
      ]);
      const modsData = await modsRes.json().catch(() => ({}));
      const runsData = await runsRes.json().catch(() => ({}));
      const runMap: Record<string, any> = {};
      (runsData.strategies || []).forEach((r: any) => { runMap[r.id] = r; });
      const mods: ModificationNotification[] = (modsData.modifications || []).map((m: any) => {
        const nu = typeof m.new_update_json === 'string' ? (() => { try { return JSON.parse(m.new_update_json); } catch { return {}; } })() : (m.new_update_json || {});
        const parts: string[] = [];
        let action: ModificationNotification['action'] = 'other';
        if (nu.action && String(nu.action).toLowerCase() === 'disconnect') { parts.push('Request to disconnect strategy'); action = 'disconnect'; }
        if (nu.mt_account_password) { parts.push('Request to change password'); action = action === 'disconnect' ? 'disconnect' : 'change-password'; }
        if (nu.mt_account_id) { parts.push(`Request to change account ID to ${nu.mt_account_id}`); action = action === 'disconnect' ? 'disconnect' : 'change-account-id'; }
        if (nu.mt_account_server) { parts.push(`Request to change server to ${nu.mt_account_server}`); action = action === 'disconnect' ? 'disconnect' : 'change-server'; }
        if (nu.platform) { parts.push(`Request to change platform to ${nu.platform}`); action = action === 'disconnect' ? 'disconnect' : 'change-platform'; }
        const run = runMap[m.running_strategy_id] || {};
        return {
          id: m.id,
          type: 'modification',
          runningStrategyId: m.running_strategy_id,
          userId: m.user_id,
          userName: run.userName,
          userEmail: run.userEmail,
          strategyName: run.strategyName,
          summary: parts.length ? parts.join('; ') : 'Update request',
          action,
          createdAt: m.created_at,
          isNew: true,
        };
      });
      setNotifications(prev => {
        const payments = prev.filter(n => (n as any).type === 'payment');
        const existingIds = prev.map(n => n.id);
        const updated = mods.map(m => ({ ...m, isNew: !existingIds.includes(m.id) }));
        const count = updated.filter(n => n.isNew).length + payments.filter(n => (n as any).isNew).length;
        setUnreadCount(count);
        return [...payments, ...updated];
      });
    } catch (e) {}
  };

  // Mark notification as read
  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, isNew: false }
          : notification
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isNew: false })));
    setUnreadCount(0);
  };

  // Handle payment approval
  const handleApprovePayment = async (notificationId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/payments/${notificationId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Remove from notifications after approval
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error approving payment:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle payment rejection
  const handleRejectPayment = async (notificationId: string) => {
    try {
      setLoading(true);
      const reason = typeof window !== 'undefined' ? window.prompt('Enter rejection reason:') : '';
      if (reason === null || !reason || reason.trim().length === 0) {
        setLoading(false);
        return;
      }
      const response = await fetch(`/api/admin/payments/${notificationId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rejectionReason: reason })
      });

      if (response.ok) {
        // Remove from notifications after rejection
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error rejecting payment:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Set up polling for new notifications
  useEffect(() => {
    fetchPendingPayments();
    fetchModifications();
    const interval = setInterval(() => {
      fetchPendingPayments();
      fetchModifications();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-gray-900">Notifications</CardTitle>
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={markAllAsRead}
                      className="text-xs"
                    >
                      Mark all read
                    </Button>
                  )}
                  {notifications.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNotifications([])}
                      className="text-xs"
                    >
                      Clear all
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${n.isNew ? 'border-l-4 border-l-blue-500' : ''}`}
                        onClick={() => markAsRead(n.id)}
                      >
                        {n.type === 'payment' ? (
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <DollarSign className="h-4 w-4 text-green-600" />
                                <span className="font-medium text-sm text-gray-900">{n.userName}</span>
                                {n.isNew && (<Badge variant="secondary" className="text-xs">New</Badge>)}
                              </div>
                              <p className="text-sm text-gray-500 mb-1">{n.userEmail}</p>
                              <p className="text-sm font-medium text-green-600 mb-1">{formatCurrency(n.amount)}</p>
                              <p className="text-xs text-gray-500 mb-2">{n.paymentMethod} • {formatDate(n.createdAt)}</p>
                              <div className="flex space-x-2">
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); handleApprovePayment(n.id); }} disabled={loading} className="text-xs"> <Check className="h-3 w-3 mr-1" /> Approve </Button>
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleRejectPayment(n.id); }} disabled={loading} className="text-xs"> <X className="h-3 w-3 mr-1" /> Reject </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                { (n as ModificationNotification).action === 'disconnect' ? (
                                  <Plug className="h-4 w-4 text-yellow-600" />
                                ) : (
                                  <Key className="h-4 w-4 text-blue-600" />
                                ) }
                                <span className="font-medium text-sm text-gray-900">{(n as ModificationNotification).userName}</span>
                                {n.isNew && (<Badge variant="secondary" className="text-xs">New</Badge>)}
                              </div>
                              <p className="text-sm text-gray-500 mb-1">{(n as ModificationNotification).userEmail}</p>
                              <p className="text-sm text-gray-600 mb-1">{(n as ModificationNotification).summary}</p>
                              <p className="text-xs text-gray-500 mb-2">{formatDate((n as ModificationNotification).createdAt || new Date().toISOString())}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PaymentNotifications;
