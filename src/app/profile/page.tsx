'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { FiUser, FiMail, FiCalendar, FiEdit2 } from 'react-icons/fi';
import UserLayout from '@/components/UserLayout';
import Button from '@/components/ui/Button';
import Link from 'next/link';

function ProfilePageContent() {
  const { data: session } = useSession();
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    createdAt: '',
    walletBalance: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; createdAt?: string }>>([]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (session?.user?.email) {
          // In a real app, you would fetch this from an API
          // For now, we'll use the session data and mock the creation date
          setUserData({
            name: session.user.name || '',
            email: session.user.email || '',
            createdAt: new Date().toISOString().split('T')[0], // Mock date
            walletBalance: 0, // Default value since walletBalance is not in the session type
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchUserData();
    }
  }, [session]);

  useEffect(() => {
    const loadNotifications = async () => {
      if (!session?.user?.id) return;
      try {
        // Wallet transactions for admin messages
        const walletRes = await fetch('/api/wallet/transactions', { cache: 'no-store' });
        const walletData = await walletRes.json();
        const wallet = (walletData.transactions ?? []).filter((t: any) => t.user_id === session.user.id);
        const adminMsgs = wallet
          .filter((t: any) => typeof t.admin_message === 'string' && t.admin_message.trim().length > 0)
          .map((t: any) => ({ id: t.id, message: `Admin: ${t.admin_message} ${t.admin_message_status ? `(${t.admin_message_status})` : ''}`, createdAt: t.updated_at || t.created_at }));

        // Renewal info from payments table (legacy)
        const [renewalRes] = await Promise.all([
          fetch('/api/payments?renewal=true')
        ]);
        const renewalData = await renewalRes.json();
        const renewals = (renewalData.payments ?? []).filter((p: any) => p.userId === session.user.id)
          .map((p: any) => ({ id: p.id, message: `Renewal: ${p.status} • ${p.plan || ''}`, createdAt: p.createdAt }));

        const combined = [...adminMsgs, ...renewals]
          .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, 10);
        setNotifications(combined);
      } catch (e) {
        setNotifications([]);
      }
    };
    loadNotifications();
  }, [session]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-[#7367f0]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#283046] rounded-lg p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Profile</h1>
        
        <div className="bg-[#161d31] rounded-lg p-6 mb-6 fx-3d-card">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="bg-[#7367f0] h-16 w-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mr-4">
                {userData.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{userData.name}</h2>
                <p className="text-gray-400">{userData.email}</p>
              </div>
            </div>
            <Link href="/settings">
              <Button className="bg-[#7367f0] hover:bg-[#5e50ee] text-white">
                <FiEdit2 className="mr-2" /> Edit Profile
              </Button>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="bg-[#283046] p-3 rounded-md mr-4">
                  <FiUser className="h-5 w-5 text-[#7367f0] " />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Full Name</p>
                  <p className="text-white">{userData.name}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <div className="bg-[#283046] p-3 rounded-md mr-4">
                  <FiMail className="h-5 w-5 text-[#7367f0] " />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Email</p>
                  <p className="text-white">{userData.email}</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="bg-[#283046] p-3 rounded-md mr-4">
                  <FiCalendar className="h-5 w-5 text-[#7367f0] " />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Joined Date</p>
                  <p className="text-white">{userData.createdAt}</p>
                </div>
              </div>
              
             
            </div>
          </div>
        </div>
        
        <div className="bg-[#161d31] rounded-lg p-6 fx-3d-card">
          <h3 className="text-lg font-semibold text-white mb-4">Account Actions</h3>
          <div className="flex flex-col md:flex-row gap-4">
            <Link href="/settings">
              <Button className="bg-[#283046] hover:bg-[#323b5c] text-white w-full md:w-auto">
                Update Profile
              </Button>
            </Link>
            <Link href="/settings#security">
              <Button className="bg-[#283046] hover:bg-[#323b5c] text-white w-full md:w-auto">
                Change Password
              </Button>
            </Link>
            <Link href="/settings#delete-account">
              <Button className="bg-red-600 hover:bg-red-700 text-white w-full md:w-auto">
                Delete Account
              </Button>
            </Link>
          </div>
        </div>

        <div className="bg-[#161d31] rounded-lg p-6 fx-3d-card mt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Notifications</h3>
          {notifications.length === 0 ? (
            <p className="text-gray-400">No recent updates</p>
          ) : (
            <ul className="space-y-2">
              {notifications.map(n => (
                <li key={n.id} className="flex items-center justify-between bg-[#283046] p-3 rounded-md">
                  <span className="text-white text-sm">{n.message}</span>
                  <span className="text-gray-400 text-xs">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// Missing FiDollarSign icon import
import { FiDollarSign } from 'react-icons/fi';

export default function ProfilePage() {
  return (
    <UserLayout>
      <ProfilePageContent />
    </UserLayout>
  );
}