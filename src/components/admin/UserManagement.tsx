'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import  Input  from '@/components/ui/Input';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Card from '@/components/ui/Card'; // Default import
import { CardContent, CardHeader, CardTitle } from '@/components/ui/Card'; // Named imports
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { FiEdit, FiTrash2, FiUserPlus } from 'react-icons/fi';
import Switch from '@/components/ui/switch';

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
};

type UserWithoutPassword = Omit<User, 'password'>;

export default function UserManagement() {
  const [users, setUsers] = useState<UserWithoutPassword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithoutPassword | null>(null);
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

  // Edit user
  const handleEditUser = (user: UserWithoutPassword) => {
    setSelectedUser(user);
    setFormData({
        name: user.name || '',
        email: user.email || '',
        role: user.role || 'USER',
        password: '', // Provide empty password to satisfy formData type
        enabled: user.enabled !== false,
      });
    setIsEditDialogOpen(true);
  };

  // Update user
  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedUser.id,
          ...formData,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }
      
      const { user } = await response.json();
      
      // Update user in state
      setUsers(users.map(u => u.id === user.id ? user : u));
      setIsEditDialogOpen(false);
      toast({
        title: 'Success',
        description: 'User updated successfully',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update user',
        variant: 'destructive',
      });
    }
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

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>User Management</CardTitle>
        <Button className="flex items-center gap-1" onClick={handleAddUserClick}>
          <FiUserPlus className="mr-1" /> Add User
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Wallet Balance</TableHead>
                <TableHead>Account Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${user.role === 'ADMIN' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell>${(user.wallet_balance ?? 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${user.enabled === false ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {user.enabled === false ? 'Disabled' : 'Enabled'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => handleEditUser(user)}
                        >
                          <FiEdit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDeleteUser(user.id)}
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

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger className="col-span-3">
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
              <Label htmlFor="enabled" className="text-right">
                Account Status
              </Label>
              <div className="col-span-3 flex items-center gap-3">
                <Switch
                  id="enabled"
                  checked={!!formData.enabled}
                  onCheckedChange={(checked) => handleSwitchChange('enabled', checked)}
                />
                <span className="text-sm">{formData.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
      
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