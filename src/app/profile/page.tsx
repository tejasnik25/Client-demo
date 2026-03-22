'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { FiMail, FiMapPin, FiCheckCircle, FiLock, FiEdit2, FiCopy, FiPhone, FiEye, FiEyeOff } from 'react-icons/fi';
import { useToast } from '@/components/ui/use-toast';
import UserLayout from '@/components/UserLayout';

function ProfileContent() {
  const { toast } = useToast();
  const { data: session, status, update } = useSession();
  const [activeTab, setActiveTab] = useState<'verification' | 'security'>('security');
  const [userData, setUserData] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    country: 'India', // Default
    uid: '', 
    verified: true,
    password_updated_at: null as string | null,
    email_updated_at: null as string | null,
    updated_at: null as string | null,
  });

  // Edit States
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [showPasswordNew, setShowPasswordNew] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [nameForm, setNameForm] = useState('');
  const [emailForm, setEmailForm] = useState('');
  const [phoneForm, setPhoneForm] = useState('');
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [isLoading, setIsLoading] = useState(false);

  // Fetch full user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setUserData(prev => ({
              ...prev,
              ...data.user,
              uid: data.user.id || '',
            }));
            setNameForm(data.user.name || '');
            setEmailForm(data.user.email || '');
            setPhoneForm(data.user.phone || '');
          }
        }
      } catch (error) {
        console.error('Failed to fetch profile', error);
      }
    };

    if (session?.user) {
      // Initialize with session data first for immediate render
      setUserData(prev => ({
        ...prev,
        name: session.user.name || '',
        email: session.user.email || '',
        phone: (session.user as any).phone || '',
        uid: (session.user as any).id || '',
      }));
      setNameForm(session.user.name || '');
      setEmailForm(session.user.email || '');
      setPhoneForm((session.user as any).phone || '');
      
      // Then fetch full details
      fetchProfile();
    }
  }, [session]);

  const handleCopyUid = () => {
    if (userData.uid) {
      navigator.clipboard.writeText(userData.uid);
      toast({
        title: "Copied",
        description: "User ID copied to clipboard",
      });
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update name');
      
      toast({
        title: "Success",
        description: "Display name updated successfully",
      });
      setUserData(prev => ({ ...prev, name: nameForm }));
      await update({ name: nameForm });
      setIsNameModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update email');
      
      toast({
        title: "Success",
        description: "Email updated successfully",
      });
      setUserData(prev => ({ 
        ...prev, 
        email: emailForm,
        email_updated_at: new Date().toISOString() 
      }));
      await update({ email: emailForm });
      setIsEmailModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update phone number');
      
      toast({
        title: "Success",
        description: "Mobile number updated successfully",
      });
      setUserData(prev => ({ 
        ...prev, 
        phone: phoneForm
      }));
      setIsPhoneModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
        toast({
            title: "Error",
            description: "Passwords do not match",
            variant: "destructive",
        });
        return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            password: passwordForm.new,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
      setPasswordForm({ current: '', new: '', confirm: '' });
      setUserData(prev => ({
          ...prev,
          password_updated_at: new Date().toISOString()
      }));
      setIsPasswordModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
      if (!dateString) return 'Never';
      return new Date(dateString).toLocaleString();
  };

  if (status === 'loading') {
    return (
        <UserLayout>
            <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div></div>
        </UserLayout>
    );
  }

  return (
    <UserLayout>
        <div className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

        {/* Header Card */}
      <div className="bg-white rounded-[40px] border border-gray-200 shadow-md px-6 py-8 md:px-10 flex flex-col md:flex-row items-center md:items-start gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-white border border-gray-200 flex items-center justify-center">
             <Image 
               src="/strategy-icon.svg" 
               alt="Profile" 
               width={80} 
               height={80} 
               className="object-contain"
             />
          </div>
        </div>
        
        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
            <h2 className="text-2xl font-bold text-gray-900">{userData.name}</h2>
            <div className="flex items-center justify-center md:justify-start gap-2">
                <button 
                    onClick={() => setIsNameModalOpen(true)}
                    className="text-gray-400 hover:text-black transition-colors"
                    title="Edit Name"
                >
                    <FiEdit2 className="w-4 h-4"/>
                </button>
                <div className="flex items-center gap-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded font-medium">
                    <span title={userData.uid}>UID: {userData.uid}</span>
                    <button 
                        onClick={handleCopyUid}
                        className="text-gray-400 hover:text-black transition-colors"
                        title="Copy UID"
                    >
                        <FiCopy className="w-3 h-3"/>
                    </button>
                </div>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1.5">
              <FiMail className="w-4 h-4" />
              <span>{userData.email}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FiMapPin className="w-4 h-4" />
              <span>{userData.country}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FiPhone className="w-4 h-4" />
              <span>{userData.phone || 'No mobile number'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-6 px-4 md:px-0 mt-8">
        <button
          className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
            activeTab === 'verification' ? 'text-black' : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('verification')}
        >
          Verification
          {activeTab === 'verification' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-black rounded-t-full" />
          )}
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium transition-colors relative ${
            activeTab === 'security' ? 'text-black' : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('security')}
        >
          Security Management
          {activeTab === 'security' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-black rounded-t-full" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        {activeTab === 'verification' && (
          <div className="text-center py-10 text-gray-500">
            <FiCheckCircle className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p>Verification details will appear here.</p>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-6">
          {/* Email Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="flex items-start gap-4">
               <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100">
                 <FiMail className="w-5 h-5 text-gray-700" />
               </div>
               <div>
                 <div className="flex items-center gap-2 mb-1">
                   <h3 className="text-base font-bold text-gray-900">Email Address</h3>
                   {userData.verified && (
                     <span className="flex items-center gap-1 text-green-500 text-xs font-medium bg-green-50 px-2 py-0.5 rounded-full">
                       <FiCheckCircle className="w-3 h-3" /> Verified
                     </span>
                   )}
                 </div>
                 <p className="text-sm text-gray-500">{userData.email}</p>
                 <p className="text-xs text-gray-400 mt-1">Last update: {formatDate(userData.email_updated_at)}</p>
                 <div className="mt-4 flex items-center gap-2">
                     <span className="text-xs text-gray-500">Login Location Change Email Notification</span>
                     <div className="w-8 h-4 bg-green-400 rounded-full relative cursor-pointer">
                         <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm"></div>
                     </div>
                 </div>
               </div>
             </div>
             <button 
                onClick={() => setIsEmailModalOpen(true)}
                className="px-6 py-2 bg-black text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
             >
               Modify
             </button>
          </div>

          {/* Mobile Number Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="flex items-start gap-4">
               <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100">
                 <FiPhone className="w-5 h-5 text-gray-700" />
               </div>
               <div>
                 <div className="flex items-center gap-2 mb-1">
                   <h3 className="text-base font-bold text-gray-900">Mobile Number</h3>
                 </div>
                 <p className="text-sm text-gray-500">{userData.phone || 'Not provided'}</p>
               </div>
             </div>
             <button 
                onClick={() => setIsPhoneModalOpen(true)}
                className="px-6 py-2 bg-black text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
             >
               {userData.phone ? 'Modify' : 'Add'}
             </button>
          </div>

          {/* Password Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="flex items-start gap-4">
               <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100">
                 <FiLock className="w-5 h-5 text-gray-700" />
               </div>
               <div>
                 <h3 className="text-base font-bold text-gray-900 mb-1">Password</h3>
                 <p className="text-xs text-gray-400">Last update: {formatDate(userData.password_updated_at)}</p>
               </div>
             </div>
             <button 
                onClick={() => setIsPasswordModalOpen(true)}
                className="px-6 py-2 bg-black text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
             >
               Modify
             </button>
          </div>
        </div>
      )}
      </div>

      {/* Name Modal */}
      {isNameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Change Display Name</h3>
            <form onSubmit={handleUpdateName}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input 
                  type="text" 
                  value={nameForm} 
                  onChange={(e) => setNameForm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsNameModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {isLoading ? 'Updating...' : 'Update Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Phone Modal */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">{userData.phone ? 'Change Mobile Number' : 'Add Mobile Number'}</h3>
            <form onSubmit={handleUpdatePhone}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input 
                  type="tel" 
                  value={phoneForm} 
                  onChange={(e) => setPhoneForm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Enter your mobile number"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsPhoneModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {isLoading ? 'Updating...' : 'Update Number'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Change Email Address</h3>
            <form onSubmit={handleUpdateEmail}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">New Email</label>
                <input 
                  type="email" 
                  value={emailForm} 
                  onChange={(e) => setEmailForm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {isLoading ? 'Updating...' : 'Update Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Change Password</h3>
            <form onSubmit={handleUpdatePassword}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPasswordNew ? 'text' : 'password'}
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPasswordNew ? 'Hide new password' : 'Show new password'}
                    title={showPasswordNew ? 'Hide new password' : 'Show new password'}
                  >
                    {showPasswordNew ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showPasswordConfirm ? 'text' : 'password'}
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPasswordConfirm ? 'Hide confirm password' : 'Show confirm password'}
                    title={showPasswordConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showPasswordConfirm ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {isLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </UserLayout>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-gray-900" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
