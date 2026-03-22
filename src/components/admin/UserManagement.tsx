'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import  Input  from '@/components/ui/Input';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Card from '@/components/ui/Card'; // Default import
import { CardContent, CardHeader, CardTitle } from '@/components/ui/Card'; // Named imports
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { FiDownload, FiEdit, FiTrash2, FiUserPlus } from 'react-icons/fi';
import Switch from '@/components/ui/switch';
import * as XLSX from 'xlsx';

// Custom User type that matches our mock data structure
export type User = {
  id: string;
  name: string;
  email: string;
  email_verified: string | null;
  password: string;
  role: string;
  wallet_balance: number;
  stock_analysis_access: boolean;
  analysis_count: number;
  trial_expiry: string | null;
  created_at: string;
  updated_at: string;
  enabled?: boolean; // Account status: enabled/disabled
  strategies?: { strategyName: string; startedAt: string }[];
};

type UserWithoutPassword = Omit<User, 'password'>;

export default function UserManagement() {
  const router = useRouter();
  const [users, setUsers] = useState<UserWithoutPassword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER',
    enabled: true,
  });

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch users');
      }
      
      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Delete user
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }
      
      // Remove user from state
      setUsers(users.filter(user => user.id !== userId));
      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete user',
        variant: 'destructive',
      });
    }
  };

  // Navigate to edit user page
  const handleEditUser = (userId: string) => {
    router.push(`/admin/users/${userId}`);
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'number' ? parseFloat(value) : value,
    });
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Handle switch changes
  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData({
      ...formData,
      [name]: checked,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md">
        <p>Error: {error}</p>
        <Button onClick={fetchUsers} className="mt-4">Try Again</Button>
      </div>
    );
  }

  // Handle opening the add user dialog
  const handleAddUserClick = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'USER',
      // walletBalance: null, // Wallet functionality removed
      enabled: true,
    });
    setIsAddDialogOpen(true);
  };

  // Handle adding a new user
  const handleAddUser = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          // walletBalance: null, // Wallet functionality removed
          enabled: formData.enabled,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add user');
      }
      
      const { user } = await response.json();
      setUsers([...users, user]);
      setIsAddDialogOpen(false);
      toast({
        title: 'Success',
        description: 'User added successfully',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to add user',
        variant: 'destructive',
      });
    }
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      return dateStr;
    }
  };

  const handleDownloadSettlementSummary = async () => {
    try {
      const res = await fetch('/api/admin/profit-sharing?view=user-summary', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to fetch settlement summary');
      const users = Array.isArray(json?.users) ? json.users : [];
      if (users.length === 0) {
        toast({ title: 'No Data', description: 'No settlement summary available yet.' });
        return;
      }
      const rows = users.map((u: any) => ({
        UserId: u.userId,
        Name: u.userName,
        Email: u.userEmail,
        Invested: Number(u.totalInvested || 0).toFixed(2),
        Profit: Number(u.totalProfit || 0).toFixed(2),
        Swap: Number(u.totalSwap || 0).toFixed(2),
        Commission: Number(u.totalCommission || 0).toFixed(2),
        Withdrawal: Number(u.totalWithdrawal || 0).toFixed(2),
        SettledBalance: Number(u.totalSettledBalance || 0).toFixed(2),
        SettlementsCount: Number(u.settlementsCount || 0),
        LastSettlementAt: u.lastSettlementAt ? new Date(u.lastSettlementAt).toLocaleString() : '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'User Settlement Summary');
      XLSX.writeFile(wb, `user-settlement-summary-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast({ title: 'Success', description: 'Settlement summary exported.' });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to export summary',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="w-full bg-white border border-gray-200 shadow-sm overflow-hidden rounded-xl">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 md:p-6 border-b border-gray-100">
        <div>
          <CardTitle className="text-gray-900 text-xl font-black">User Management</CardTitle>
          <p className="text-xs font-medium text-gray-500 mt-1">Monitor and manage platform users</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-4 rounded-lg border-gray-200 hover:bg-gray-50 text-xs font-bold" 
            onClick={handleDownloadSettlementSummary}
          >
            <FiDownload className="w-4 h-4" /> 
            <span>Summary</span>
          </Button>
          <Button 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-6 rounded-lg bg-[#00d09c] hover:bg-[#00b085] text-white text-xs font-black uppercase tracking-wider shadow-sm" 
            onClick={handleAddUserClick}
          >
            <FiUserPlus className="w-4 h-4" /> 
            Add User
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        <div className="rounded-none sm:rounded-lg bg-white border-0 sm:border border-gray-100 text-gray-900 overflow-x-auto scrollbar-hide">
          <Table className="min-w-[800px] sm:min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead>User Details</TableHead>
                <TableHead>Account Created</TableHead>
                <TableHead>Copying Strategy</TableHead>
                <TableHead>Copying Started</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{user.name}</span>
                        <span className="text-xs text-gray-500">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500 whitespace-nowrap">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell>
                      {user.strategies && user.strategies.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded truncate max-w-[120px]">
                            {user.strategies[0].strategyName}
                          </span>
                          {user.strategies.length > 1 && (
                            <span className="text-[10px] text-gray-400 font-bold italic">
                              +{user.strategies.length - 1} more...
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-500 whitespace-nowrap">
                      {user.strategies && user.strategies.length > 0 ? (
                        <span className="text-xs">
                          {formatDate(user.strategies[0].startedAt)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${user.enabled === false ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {user.enabled === false ? 'Disabled' : 'Enabled'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                          onClick={() => handleEditUser(user.id)}
                          title="Edit User / Change Password"
                        >
                          <FiEdit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteUser(user.id)}
                          title="Delete User"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      
      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-name" className="text-right">
                Name
              </Label>
              <Input
                id="new-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-email" className="text-right">
                Email
              </Label>
              <Input
                id="new-email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-password" className="text-right">
                Password
              </Label>
              <Input
                id="new-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-role" className="text-right">
                Role
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger className="col-span-3" id="new-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Wallet balance field removed */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-enabled" className="text-right">
                Account Status
              </Label>
              <div className="col-span-3 flex items-center gap-3">
                <Switch
                  id="new-enabled"
                  checked={!!formData.enabled}
                  onCheckedChange={(checked) => handleSwitchChange('enabled', checked)}
                />
                <span className="text-sm">{formData.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser}>Add User</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
