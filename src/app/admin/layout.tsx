'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Sidebar } from '@/components/admin/Sidebar';
import { Header } from '@/components/admin/Header';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated and has admin role
    if (status === 'unauthenticated') {
      router.push('/admin-login'); // Redirect to admin login page
    } else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      // Redirect non-admin users to dashboard
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
      </div>
    );
  }

  // Only render admin layout if user is authenticated and has admin role
  if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
    return (
      <div className="flex h-screen bg-[#0e1726] text-gray-300">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 bg-[#0e1726]">{children}</main>
        </div>
      </div>
    );
  }

  // Return null for other cases (will redirect in useEffect)
  return null;
}