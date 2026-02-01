'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import UserManagement from '@/components/admin/UserManagement';
import { FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    
    const isAdminSessionActive = typeof window !== 'undefined' && 
                               localStorage.getItem('adminSessionActive') === 'true';
    
    if (status === 'unauthenticated') {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('adminSessionActive');
      }
      router.push('/admin-login');
    } else if (status === 'authenticated') {
      if (isAdminSessionActive && session?.user?.role !== 'ADMIN') {
        alert('Admin session has expired or been replaced. Redirecting to user dashboard.');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('adminSessionActive');
        }
        router.push('/dashboard');
      }
      else if (!isAdminSessionActive && session?.user?.role !== 'ADMIN') {
        router.push('/dashboard');
      }
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (status === 'unauthenticated' || (session?.user?.role !== 'ADMIN')) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-6">
        <Link href="/admin" className="mr-4">
          <FiArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-3xl font-bold">User Management</h1>
      </div>
      
      <div className="rounded-lg p-6 bg-white border border-gray-200">
        <UserManagement />
      </div>
    </div>
  );
}
