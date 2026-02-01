'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  FiDollarSign, 
  FiTrendingUp, 
  FiUsers, 
  FiActivity, 
  FiClock, 
  FiCheckCircle,
  FiXCircle,
  FiBarChart2,
  FiPieChart
} from 'react-icons/fi';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#00d09c', '#00b085', '#7c3aed', '#a855f7', '#f59e0b', '#ef4444'];

export default function AdminAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>({
    totalProfit: 0,
    totalPayments: 0,
    totalStrategies: 0,
    runningStrategies: 0,
    pendingPayments: 0,
    pendingStrategies: 0,
    approvedPayments: 0,
    rejectedPayments: 0,
    totalUsers: 0,
    activeUsers: 0,
    newStrategies: 0,
    renewalStrategies: 0,
    modificationStrategies: 0,
  });

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || !session || session.user.role !== 'ADMIN') {
      router.push('/admin-login');
    }
  }, [session, status, router]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const [strategiesRes, paymentsRes, runningRes] = await Promise.all([
          fetch('/api/strategies', { cache: 'no-store' }),
          fetch('/api/payments', { cache: 'no-store' }),
          fetch('/api/admin/running-strategies', { cache: 'no-store' })
        ]);

        const strategiesData = await strategiesRes.json();
        const paymentsData = await paymentsRes.json();
        const runningData = await runningRes.json();

        const allStrategies = strategiesData.strategies || [];
        const allPayments = paymentsData.payments || [];
        const runningStrategies = runningData.strategies || [];
        
        // Get unique users from running strategies and payments
        const userIdsFromStrategies = new Set(runningStrategies.map((s: any) => s.userId).filter(Boolean));
        const userIdsFromPayments = new Set(allPayments.map((p: any) => p.user_id || p.userId).filter(Boolean));
        const allUserIds = new Set([...userIdsFromStrategies, ...userIdsFromPayments]);
        const allUsers = Array.from(allUserIds).map((id: any) => ({ id }));

        // Calculate total profit from all strategies
        const totalProfit = allStrategies.reduce((sum: number, s: any) => {
          const profit = parseFloat(s.profit) || 0;
          return sum + profit;
        }, 0);

        // Calculate total payments received (approved/completed)
        const approvedPayments = allPayments.filter((p: any) => {
          const status = (p.status || '').toLowerCase();
          return status === 'approved' || status === 'completed' || status === 'renewal_approved';
        });
        const totalPayments = approvedPayments.reduce((sum: number, p: any) => {
          const amount = parseFloat(p.payable) || parseFloat(p.amount) || 0;
          return sum + amount;
        }, 0);

        // Count strategies
        const enabledStrategies = allStrategies.filter((s: any) => s.enabled !== false);
        const running = runningStrategies.filter((s: any) => 
          (s.adminStatus || '').toLowerCase() === 'running'
        );
        const pending = runningStrategies.filter((s: any) => 
          (s.adminStatus || '').toLowerCase() !== 'running'
        );

        // Count payments by status
        const pendingPayments = allPayments.filter((p: any) => {
          const status = (p.status || '').toLowerCase();
          return status === 'pending' || status === 'in-process';
        });
        const rejectedPayments = allPayments.filter((p: any) => {
          const status = (p.status || '').toLowerCase();
          return status === 'rejected' || status === 'failed';
        });

        // Count by type
        const newStrategies = allPayments.filter((p: any) => {
          const status = (p.status || '').toLowerCase();
          return !status.includes('renewal') && (status === 'approved' || status === 'completed');
        }).length;
        const renewalStrategies = allPayments.filter((p: any) => {
          const status = (p.status || '').toLowerCase();
          return status.includes('renewal') && (status === 'renewal_approved' || status === 'approved');
        }).length;

        // Count modifications
        const modificationStrategies = runningStrategies.filter((s: any) => {
          const status = (s.adminStatus || '').toLowerCase();
          return status === 'in-process' || status === 'requested';
        }).length;

        // Count active users (users with at least one running strategy)
        const activeUserIds = new Set(running.map((s: any) => s.userId));
        const activeUsers = activeUserIds.size;

        setAnalytics({
          totalProfit,
          totalPayments,
          totalStrategies: enabledStrategies.length,
          runningStrategies: running.length,
          pendingPayments: pendingPayments.length,
          pendingStrategies: pending.length,
          approvedPayments: approvedPayments.length,
          rejectedPayments: rejectedPayments.length,
          totalUsers: allUsers.length,
          activeUsers,
          newStrategies,
          renewalStrategies,
          modificationStrategies,
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  // Chart data
  const paymentStatusData = useMemo(() => [
    { name: 'Approved', value: analytics.approvedPayments, color: '#00d09c' },
    { name: 'Pending', value: analytics.pendingPayments, color: '#f59e0b' },
    { name: 'Rejected', value: analytics.rejectedPayments, color: '#ef4444' },
  ], [analytics]);

  const strategyStatusData = useMemo(() => [
    { name: 'Running', value: analytics.runningStrategies, color: '#00d09c' },
    { name: 'Pending', value: analytics.pendingStrategies, color: '#f59e0b' },
  ], [analytics]);

  const strategyTypeData = useMemo(() => [
    { name: 'New', value: analytics.newStrategies, color: '#00d09c' },
    { name: 'Renewal', value: analytics.renewalStrategies, color: '#7c3aed' },
    { name: 'Modification', value: analytics.modificationStrategies, color: '#f59e0b' },
  ], [analytics]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00d09c]"></div>
      </div>
    );
  }

  if (status !== 'authenticated' || !session || session.user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Analytics Dashboard</h1>
          <p className="text-gray-600">Comprehensive overview of platform performance and metrics</p>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Profit */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Profit</p>
                <p className="text-2xl font-bold text-gray-900">${analytics.totalProfit.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <FiTrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Total Payments Received */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Payments</p>
                <p className="text-2xl font-bold text-gray-900">${analytics.totalPayments.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <FiDollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Listed Strategies */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Listed Strategies</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalStrategies}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <FiBarChart2 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Running Strategies */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Running Strategies</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.runningStrategies}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <FiActivity className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pending Payments */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Payments</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.pendingPayments}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <FiClock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          {/* Pending Strategies */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Strategies</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.pendingStrategies}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <FiClock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          {/* Approved Payments */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Approved Payments</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.approvedPayments}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <FiCheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Total Users */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalUsers}</p>
                <p className="text-xs text-gray-500 mt-1">{analytics.activeUsers} active</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <FiUsers className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Status Chart */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Strategy Status Chart */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={strategyStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {strategyStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Strategy Type Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Type Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={strategyTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#00d09c" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategy Types</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">New Strategies</span>
                <span className="font-semibold text-gray-900">{analytics.newStrategies}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Renewal Strategies</span>
                <span className="font-semibold text-gray-900">{analytics.renewalStrategies}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Modification Requests</span>
                <span className="font-semibold text-gray-900">{analytics.modificationStrategies}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Received</span>
                <span className="font-semibold text-green-600">${analytics.totalPayments.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Approved</span>
                <span className="font-semibold text-gray-900">{analytics.approvedPayments}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Pending</span>
                <span className="font-semibold text-yellow-600">{analytics.pendingPayments}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Rejected</span>
                <span className="font-semibold text-red-600">{analytics.rejectedPayments}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Activity</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Users</span>
                <span className="font-semibold text-gray-900">{analytics.totalUsers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Active Users</span>
                <span className="font-semibold text-green-600">{analytics.activeUsers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Running Strategies</span>
                <span className="font-semibold text-gray-900">{analytics.runningStrategies}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

