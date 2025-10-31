'use client';
import React, { useState, useEffect } from 'react';
import { Bell, X, Check, AlertCircle, DollarSign } from 'lucide-react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

interface PaymentNotification {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  receiptPath?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  isNew?: boolean;
}

interface PaymentNotificationsProps {
  className?: string;
}

const PaymentNotifications: React.FC<PaymentNotificationsProps> = ({ className }) => {
  const [notifications, setNotifications] = useState<PaymentNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch pending payments
  const fetchPendingPayments = async () => {
    try {
      const response = await fetch('/api/admin/payments/pending');
      if (response.ok) {
        const data = await response.json();
        const newNotifications = data.transactions || [];
        
        // Mark new notifications
        const existingIds = notifications.map(n => n.id);
        const updatedNotifications = newNotifications.map((notification: PaymentNotification) => ({
          ...notification,
          isNew: !existingIds.includes(notification.id)
        }));
        
        setNotifications(updatedNotifications);
        
        // Count unread notifications
        const newCount = updatedNotifications.filter((n: PaymentNotification) => n.isNew).length;
        setUnreadCount(newCount);
      }
    } catch (error) {
      console.error('Error fetching payment notifications:', error);
    }
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
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, isNew: false }))
    );
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
    
    // Poll every 10 seconds for new payments
    const interval = setInterval(fetchPendingPayments, 10000);
    
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
                <CardTitle className="text-lg">Payment Notifications</CardTitle>
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
                    <p>No pending payments</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          notification.isNew ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                        }`}
                        onClick={() => markAsRead(notification.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              <span className="font-medium text-sm">
                                {notification.userName}
                              </span>
                              {notification.isNew && (
                                <Badge variant="secondary" className="text-xs">
                                  New
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-1">
                              {notification.userEmail}
                            </p>
                            <p className="text-sm font-medium text-green-600 mb-1">
                              {formatCurrency(notification.amount)}
                            </p>
                            <p className="text-xs text-gray-500 mb-2">
                              {notification.paymentMethod} • {formatDate(notification.createdAt)}
                            </p>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprovePayment(notification.id);
                                }}
                                disabled={loading}
                                className="text-xs"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRejectPayment(notification.id);
                                }}
                                disabled={loading}
                                className="text-xs"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
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