'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Switch from '@/components/ui/switch';
import { FiArrowLeft, FiRefreshCw, FiShield, FiUser, FiActivity, FiSettings, FiEye, FiEyeOff } from 'react-icons/fi';

export default function UserDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER',
    enabled: true,
  });

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/users/${id}`);
      if (!response.ok) throw new Error('Failed to fetch user details');
      const data = await response.json();
      setUser(data.user);
      setStrategies(data.strategies);
      setFormData({
        name: data.user.name || '',
        email: data.user.email || '',
        password: '',
        role: data.user.role || 'USER',
        enabled: data.user.enabled !== false,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load user details',
        variant: 'destructive',
      });
      router.push('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDetails();
  }, [id]);

  const handleUpdateUser = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...formData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }

      toast({ title: 'Success', description: 'User updated successfully' });
      fetchUserDetails();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update user',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-8 bg-gray-50/50 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/admin/users')}
            className="p-2 hover:bg-white rounded-full transition-all border border-transparent hover:border-gray-200"
          >
            <FiArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">User Profile</h1>
            <p className="text-sm font-medium text-gray-500 mt-1">Manage account details and view performance analytics</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchUserDetails} 
          className="bg-white border-gray-200 hover:bg-gray-50 flex items-center gap-2"
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Sidebar */}
        <div className="space-y-6">
          <Card className="bg-white border-gray-200 overflow-hidden shadow-sm">
            <CardHeader className="bg-[#00d09c] text-white p-8">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center border-4 border-white/30 backdrop-blur-sm">
                  <FiUser className="w-12 h-12 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black">{user?.name}</h2>
                  <p className="text-sm font-bold opacity-80">{user?.email}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border-2 ${user?.role === 'ADMIN' ? 'bg-purple-500 border-purple-400' : 'bg-blue-500 border-blue-400'}`}>
                    {user?.role}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border-2 ${user?.enabled !== false ? 'bg-green-500 border-green-400' : 'bg-red-500 border-red-400'}`}>
                    {user?.enabled !== false ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Account Created</span>
                  <span className="text-xs font-black text-gray-900">{new Date(user?.createdAt || user?.created_at || user?.createdAt || Date.now()).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Wallet Balance</span>
                  <span className="text-xs font-black text-gray-900">${user?.wallet_balance || '0.00'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Strategies</span>
                  <span className="text-xs font-black text-gray-900">{strategies.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          <Tabs defaultValue="strategies" className="w-full">
            <TabsList className="bg-white border border-gray-200 p-1 rounded-xl shadow-sm mb-6">
              <TabsTrigger value="strategies" className="data-[state=active]:bg-[#00d09c] data-[state=active]:text-white rounded-lg font-black uppercase tracking-wider text-[10px] py-3 px-8 transition-all flex items-center gap-2">
                <FiActivity className="w-4 h-4" />
                Copying Strategies
              </TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-[#00d09c] data-[state=active]:text-white rounded-lg font-black uppercase tracking-wider text-[10px] py-3 px-8 transition-all flex items-center gap-2">
                <FiSettings className="w-4 h-4" />
                Account Details
              </TabsTrigger>
            </TabsList>

            <TabsContent value="strategies" className="space-y-6 outline-none">
              {strategies.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[2rem] border border-gray-100 shadow-sm">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiActivity className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-black text-gray-900">No Active Strategies</h3>
                  <p className="text-sm font-medium text-gray-400">This user is not currently copying any strategies.</p>
                </div>
              ) : (
                <>
                  {/* Total Performance Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card className="bg-white border-gray-100 shadow-sm rounded-2xl p-6">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Equity</p>
                      <h3 className="text-2xl font-black text-gray-900">
                        ${strategies.reduce((sum, s) => sum + (s.metrics?.equity || 0), 0).toFixed(2)}
                      </h3>
                    </Card>
                    <Card className="bg-white border-gray-100 shadow-sm rounded-2xl p-6">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Profit</p>
                      <h3 className={`text-2xl font-black ${strategies.reduce((sum, s) => sum + (s.metrics?.realizedProfit + s.metrics?.floatingProfit || 0), 0) >= 0 ? 'text-[#00d09c]' : 'text-red-500'}`}>
                        ${strategies.reduce((sum, s) => sum + (s.metrics?.realizedProfit + s.metrics?.floatingProfit || 0), 0).toFixed(2)}
                      </h3>
                    </Card>
                    <Card className="bg-white border-gray-100 shadow-sm rounded-2xl p-6">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Active Positions</p>
                      <h3 className="text-2xl font-black text-gray-900">
                        {strategies.reduce((sum, s) => sum + (s.metrics?.openTrades || 0), 0)}
                      </h3>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {strategies.map((rs) => (
                    <Card key={rs.id} className="bg-white border-gray-100 shadow-sm rounded-[1.5rem] overflow-hidden hover:shadow-md transition-all group">
                      <div className="p-6">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100 group-hover:scale-105 transition-transform">
                            <img src={rs.strategyImage || '/default-strategy.svg'} alt={rs.strategyName} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-black text-gray-900 text-sm">{rs.strategyName}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${rs.adminStatus === 'running' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                {rs.adminStatus}
                              </span>
                              <span className="text-[10px] font-bold text-gray-400">Plan: {rs.plan}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Capital</p>
                            <p className="text-sm font-black text-gray-900">${Number(rs.capital).toFixed(2)}</p>
                          </div>
                          <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Profit</p>
                            <p className={`text-sm font-black ${(rs.metrics?.realizedProfit + rs.metrics?.floatingProfit) >= 0 ? 'text-[#00d09c]' : 'text-red-500'}`}>
                              ${(rs.metrics?.realizedProfit + rs.metrics?.floatingProfit).toFixed(2)}
                            </p>
                          </div>
                          <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Floating P/L</p>
                            <p className={`text-sm font-black ${rs.metrics?.floatingProfit >= 0 ? 'text-[#00d09c]' : 'text-red-500'}`}>
                              ${rs.metrics?.floatingProfit.toFixed(2)}
                            </p>
                          </div>
                          <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Equity</p>
                            <p className="text-sm font-black text-gray-900">${rs.metrics?.equity.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-50">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-gray-400 uppercase">Started At</span>
                            <span className="text-[11px] font-black text-gray-900">{new Date(rs.createdAt || rs.created_at || Date.now()).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="settings" className="outline-none">
              <Card className="bg-white border-gray-200 shadow-sm rounded-[2rem] max-w-2xl mx-auto">
                <CardHeader className="p-8 border-b border-gray-50 flex flex-row items-center justify-between">
                  <CardTitle className="text-xl font-black text-gray-900">Edit User</CardTitle>
                  <button onClick={() => router.push('/admin/users')} className="text-gray-400 hover:text-gray-600">
                    <FiArrowLeft className="w-5 h-5" />
                  </button>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="space-y-6">
                    {/* Name */}
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-sm font-bold text-gray-600 text-right">Name</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="col-span-2 h-10 bg-gray-50/50 border-gray-100 rounded-lg focus:border-[#00d09c] font-medium"
                      />
                    </div>

                    {/* Email */}
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-sm font-bold text-gray-600 text-right">Email</Label>
                      <Input
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="col-span-2 h-10 bg-gray-50/50 border-gray-100 rounded-lg focus:border-[#00d09c] font-medium"
                      />
                    </div>

                    <div className="border-t border-gray-100 pt-6"></div>

                    {/* Update Password */}
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-sm font-bold text-blue-600 text-right">Update Password</Label>
                      <div className="col-span-2 relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Leave blank to keep current"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="h-10 bg-gray-50/50 border-gray-100 rounded-lg focus:border-[#00d09c] font-medium pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Show Current Password (Admin Only) */}
                    <div className="grid grid-cols-3 items-center gap-4 pt-2">
                      <Label className="text-xs font-bold text-gray-400 text-right uppercase tracking-wider">Current Password</Label>
                      <div className="col-span-2 flex items-center gap-3">
                        <div className="flex-1 px-3 py-2 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-xs font-mono text-gray-600 break-all">
                          {showCurrentPassword ? 'Stored Password is kept securely hashed and is not displayable' : '••••••••••••••••'}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-400 hover:text-gray-600"
                          title={showCurrentPassword ? "Hide password info" : "Show password info"}
                        >
                          {showCurrentPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Role */}
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-sm font-bold text-gray-600 text-right">Role</Label>
                      <div className="col-span-2">
                        <Select
                          value={formData.role}
                          onValueChange={(value) => setFormData({ ...formData, role: value })}
                        >
                          <SelectTrigger className="h-10 bg-gray-50/50 border-gray-100 rounded-lg font-medium">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-gray-100 rounded-lg">
                            <SelectItem value="USER" className="font-medium">User</SelectItem>
                            <SelectItem value="ADMIN" className="font-medium">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Account Status */}
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-sm font-bold text-gray-600 text-right">Account Status</Label>
                      <div className="col-span-2 flex items-center gap-4">
                        <span className={`text-sm font-bold ${formData.enabled ? 'text-green-600' : 'text-red-600'}`}>
                          {formData.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <Switch
                          checked={formData.enabled}
                          onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 flex justify-center gap-4">
                    <Button 
                      variant="outline" 
                      onClick={() => router.push('/admin/users')} 
                      className="h-10 px-8 border-gray-200 text-gray-600 font-bold rounded-lg"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleUpdateUser} 
                      className="h-10 px-10 bg-[#00d09c] hover:bg-[#00b085] text-white font-bold rounded-lg transition-all shadow-sm"
                    >
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
