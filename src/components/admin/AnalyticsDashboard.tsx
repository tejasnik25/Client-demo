'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import Card, { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { FiUsers, FiDollarSign, FiTrendingUp, FiActivity } from 'react-icons/fi';

interface AnalyticsData {
  users: {
    total: number;
    active: number;
    inactive: number;
    admin: number;
    regular: number;
  };
  payments: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  revenue: {
    total: number;
  };
  strategies: {
    total: number;
  };
}

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  purple: '#8b5cf6'
};

export default function AnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    users: { total: 0, active: 0, inactive: 0, admin: 0, regular: 0 },
    payments: { total: 0, pending: 0, approved: 0, rejected: 0 },
    revenue: { total: 0 },
    strategies: { total: 0 }
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch('/api/admin/analytics');
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }
        const data = await response.json();
        setAnalyticsData(data);
      } catch (err) {
        console.error('Error fetching analytics:', err);
      }
    };
    fetchAnalytics();
  }, []);

  // Prepare data for charts
  const userStatusData = [
    { name: 'Active Users', value: analyticsData.users.active, color: COLORS.success },
    { name: 'Inactive Users', value: analyticsData.users.inactive, color: COLORS.warning }
  ];

  const userRoleData = [
    { name: 'Regular Users', value: analyticsData.users.regular, color: COLORS.primary },
    { name: 'Admin Users', value: analyticsData.users.admin, color: COLORS.purple }
  ];

  const paymentStatusData = [
    { name: 'Approved', value: analyticsData.payments.approved, color: COLORS.success },
    { name: 'Pending', value: analyticsData.payments.pending, color: COLORS.warning },
    { name: 'Rejected', value: analyticsData.payments.rejected, color: COLORS.danger }
  ];

  const overviewData = [
    { category: 'Users', count: analyticsData.users.total },
    { category: 'Payments', count: analyticsData.payments.total },
    { category: 'Strategies', count: analyticsData.strategies.total },
    { category: 'Revenue', count: analyticsData.revenue.total }
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium text-gray-900">{`${label}: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Analytics Dashboard</h2>
        <p className="text-sm font-medium text-gray-500 mt-1">Real-time system performance and user statistics</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-gray-500">Total Users</CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg">
              <FiUsers className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-gray-900">{analyticsData.users.total}</div>
            <p className="text-xs font-bold text-green-600 mt-1">
              {analyticsData.users.active} active members
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-gray-500">Total Payments</CardTitle>
            <div className="p-2 bg-[#00d09c]/10 rounded-lg">
              <FiDollarSign className="h-4 w-4 text-[#00d09c]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-gray-900">{analyticsData.payments.total}</div>
            <p className="text-xs font-bold text-[#00d09c] mt-1">
              {analyticsData.payments.approved} approved
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-gray-500">Total Revenue</CardTitle>
            <div className="p-2 bg-purple-50 rounded-lg">
              <FiTrendingUp className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-gray-900">${analyticsData.revenue.total}</div>
            <p className="text-xs font-bold text-purple-600 mt-1">
              From approved transactions
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-gray-500">Strategies</CardTitle>
            <div className="p-2 bg-orange-50 rounded-lg">
              <FiActivity className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-gray-900">{analyticsData.strategies.total}</div>
            <p className="text-xs font-bold text-orange-600 mt-1">
              Currently available
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Status Pie Chart */}
        <Card className="rounded-2xl border border-gray-100 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gray-50/30">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-gray-900">User Status Distribution</CardTitle>
            <CardDescription className="text-xs font-medium">Active vs Inactive Users</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={userStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {userStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Status Pie Chart */}
        <Card className="rounded-2xl border border-gray-100 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gray-50/30">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-gray-900">Payment Status Distribution</CardTitle>
            <CardDescription className="text-xs font-medium">Approval pipeline overview</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
        {/* Overview Bar Chart */}
        <Card className="rounded-2xl border border-gray-100 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gray-50/30">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-gray-900">System Overview</CardTitle>
            <CardDescription className="text-xs font-medium">Total counts across different categories</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overviewData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="count" fill="#00d09c" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* User Role Distribution */}
        <Card className="rounded-2xl border border-gray-100 shadow-sm bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gray-50/30">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-gray-900">User Role Distribution</CardTitle>
            <CardDescription className="text-xs font-medium">Access level distribution</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={userRoleData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {userRoleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}