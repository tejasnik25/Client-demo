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
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Analytics Dashboard</h1>
            <p className="text-sm font-medium text-gray-500 mt-1">Platform performance and key metrics overview</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-[#00d09c]/10 text-[#00d09c] rounded-xl text-xs font-black uppercase tracking-wider">
            <FiClock className="w-4 h-4" />
            Real-time Data
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            icon={<FiTrendingUp />} 
            label="Total Profit" 
            value={`$${analytics.totalProfit.toLocaleString()}`} 
            color="green" 
          />
          <StatCard 
            icon={<FiDollarSign />} 
            label="Total Payments" 
            value={`$${analytics.totalPayments.toLocaleString()}`} 
            color="blue" 
          />
          <StatCard 
            icon={<FiBarChart2 />} 
            label="Listed Strategies" 
            value={analytics.totalStrategies.toString()} 
            color="purple" 
          />
          <StatCard 
            icon={<FiActivity />} 
            label="Running Strategies" 
            value={analytics.runningStrategies.toString()} 
            color="green" 
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            icon={<FiClock />} 
            label="Pending Payments" 
            value={analytics.pendingPayments.toString()} 
            color="yellow" 
          />
          <StatCard 
            icon={<FiClock />} 
            label="Pending Strategies" 
            value={analytics.pendingStrategies.toString()} 
            color="yellow" 
          />
          <StatCard 
            icon={<FiCheckCircle />} 
            label="Approved Payments" 
            value={analytics.approvedPayments.toString()} 
            color="green" 
          />
          <StatCard 
            icon={<FiUsers />} 
            label="Total Users" 
            value={analytics.totalUsers.toString()} 
            subValue={`${analytics.activeUsers} active`}
            color="blue" 
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChartContainer title="Payment Status Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>

          <ChartContainer title="Strategy Status Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={strategyStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {strategyStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Strategy Type Breakdown */}
        <ChartContainer title="Strategy Type Breakdown">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={strategyTypeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700 }} />
              <Tooltip 
                cursor={{ fill: '#f8f8f8' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
              />
              <Legend iconType="circle" />
              <Bar dataKey="value" fill="#00d09c" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Detailed Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <StatsCard title="Strategy Metrics">
            <StatsItem label="New Strategies" value={analytics.newStrategies} />
            <StatsItem label="Renewal Strategies" value={analytics.renewalStrategies} />
            <StatsItem label="Modification Requests" value={analytics.modificationStrategies} />
          </StatsCard>

          <StatsCard title="Financial Summary">
            <StatsItem label="Total Received" value={`$${analytics.totalPayments.toLocaleString()}`} highlight="green" />
            <StatsItem label="Approved" value={analytics.approvedPayments} />
            <StatsItem label="Pending" value={analytics.pendingPayments} highlight="yellow" />
            <StatsItem label="Rejected" value={analytics.rejectedPayments} highlight="red" />
          </StatsCard>

          <StatsCard title="User Engagement">
            <StatsItem label="Total Registered" value={analytics.totalUsers} />
            <StatsItem label="Active Copiers" value={analytics.activeUsers} highlight="green" />
            <StatsItem label="Running Portfolios" value={analytics.runningStrategies} />
          </StatsCard>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subValue, color }: { icon: any, label: string, value: string, subValue?: string, color: string }) {
  const colors: any = {
    green: "bg-green-50 text-green-600 border-green-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    yellow: "bg-yellow-50 text-yellow-600 border-yellow-100",
    red: "bg-red-50 text-red-600 border-red-100",
  };

  return (
    <div className="bg-white rounded-[1.5rem] border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl ${colors[color]} border group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-black text-gray-900 tracking-tight">{value}</h3>
        {subValue && <span className="text-[10px] font-bold text-gray-400">{subValue}</span>}
      </div>
    </div>
  );
}

function ChartContainer({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
      <h3 className="text-lg font-black text-gray-900 mb-8 uppercase tracking-tight">{title}</h3>
      {children}
    </div>
  );
}

function StatsCard({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
        <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="p-6 space-y-4">
        {children}
      </div>
    </div>
  );
}

function StatsItem({ label, value, highlight }: { label: string, value: any, highlight?: string }) {
  const highlights: any = {
    green: "text-[#00d09c]",
    yellow: "text-orange-500",
    red: "text-red-500",
    blue: "text-blue-500",
  };

  return (
    <div className="flex justify-between items-center">
      <span className="text-xs font-bold text-gray-500">{label}</span>
      <span className={`text-sm font-black ${highlight ? highlights[highlight] : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}


