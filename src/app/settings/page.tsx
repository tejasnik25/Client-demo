'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FiUser, FiLock, FiAlertTriangle } from 'react-icons/fi';
import UserLayout from '@/components/UserLayout';
import Button  from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function SettingsPageContent() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Form states
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  
  useEffect(() => {
    if (session?.user) {
      setProfileData({
        name: session.user.name || '',
        email: session.user.email || '',
      });
    }
  }, [session]);
  
  // Handle profile update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      // In a real app, you would call an API endpoint
      // For demo purposes, we'll just simulate a successful update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update session data
      await update({
        ...session,
        user: {
          ...session?.user,
          name: profileData.name,
          email: profileData.email,
        },
      });
      
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });
    
    // Validate passwords
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      setIsLoading(false);
      return;
    }
    
    try {
      // In a real app, you would call an API endpoint
      // For demo purposes, we'll just simulate a successful update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Error changing password:', error);
      setMessage({ type: 'error', text: 'Failed to change password. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle account deletion
  const handleAccountDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });
    
    // Validate confirmation
    if (deleteConfirmation !== 'DELETE') {
      setMessage({ type: 'error', text: 'Please type DELETE to confirm account deletion.' });
      setIsLoading(false);
      return;
    }
    
    try {
      // In a real app, you would call an API endpoint
      // For demo purposes, we'll just simulate a successful deletion
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to logout
      router.push('/api/auth/signout');
    } catch (error) {
      console.error('Error deleting account:', error);
      setMessage({ type: 'error', text: 'Failed to delete account. Please try again.' });
      setIsLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-[#283046] rounded-lg p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>
        
        <Tabs defaultValue="profile" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-[#161d31] mb-6">
            <TabsTrigger value="profile" className="data-[state=active]:bg-[#7367f0] data-[state=active]:text-white">
              <FiUser className="mr-2 fx-3d-icon" /> Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-[#7367f0] data-[state=active]:text-white">
              <FiLock className="mr-2 fx-3d-icon" /> Security
            </TabsTrigger>
            <TabsTrigger value="delete-account" className="data-[state=active]:bg-[#7367f0] data-[state=active]:text-white">
              <FiAlertTriangle className="mr-2 fx-3d-icon" /> Delete Account
            </TabsTrigger>
          </TabsList>
          
          {message.text && (
            <div className={`p-4 mb-6 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {message.text}
            </div>
          )}
          
          <TabsContent value="profile" className="bg-[#161d31] rounded-lg p-6 fx-3d-card">
            <h2 className="text-xl font-semibold text-white mb-4">Profile Information</h2>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="w-full p-2 bg-[#283046] border border-gray-600 rounded-md text-white"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  className="w-full p-2 bg-[#283046] border border-gray-600 rounded-md text-white"
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                className="bg-[#7367f0] hover:bg-[#5e50ee] text-white"
                disabled={isLoading}
              >
                {isLoading ? 'Updating...' : 'Update Profile'}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="security" className="bg-[#161d31] rounded-lg p-6 fx-3d-card">
            <h2 className="text-xl font-semibold text-white mb-4">Change Password</h2>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-400 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full p-2 bg-[#283046] border border-gray-600 rounded-md text-white"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-400 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full p-2 bg-[#283046] border border-gray-600 rounded-md text-white"
                  required
                  minLength={8}
                />
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-400 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full p-2 bg-[#283046] border border-gray-600 rounded-md text-white"
                  required
                  minLength={8}
                />
              </div>
              
              <Button 
                type="submit" 
                className="bg-[#7367f0] hover:bg-[#5e50ee] text-white"
                disabled={isLoading}
              >
                {isLoading ? 'Changing...' : 'Change Password'}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="delete-account" className="bg-[#161d31] rounded-lg p-6 fx-3d-card">
            <h2 className="text-xl font-semibold text-red-500 mb-4">Delete Account</h2>
            <div className="bg-red-900/20 border border-red-700 rounded-md p-4 mb-6">
              <p className="text-white mb-2">Warning: This action cannot be undone.</p>
              <p className="text-gray-400">Deleting your account will permanently remove all your data from our systems, including your profile, strategies, and transaction history.</p>
            </div>
            
            <form onSubmit={handleAccountDeletion} className="space-y-4">
              <div>
                <label htmlFor="deleteConfirmation" className="block text-sm font-medium text-gray-400 mb-1">
                  Type DELETE to confirm
                </label>
                <input
                  type="text"
                  id="deleteConfirmation"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="w-full p-2 bg-[#283046] border border-gray-600 rounded-md text-white"
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={isLoading || deleteConfirmation !== 'DELETE'}
              >
                {isLoading ? 'Deleting...' : 'Delete My Account'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <UserLayout>
      <SettingsPageContent />
    </UserLayout>
  );
}