'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import PaymentVerification from '@/components/admin/PaymentVerification';
import { FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';

export default function AdminPaymentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Do nothing while loading
    
    // Check if this is an active admin session
    const isAdminSessionActive = typeof window !== 'undefined' && 
                               localStorage.getItem('adminSessionActive') === 'true';
    
    if (status === 'unauthenticated') {
      // Clear admin session indicator if not authenticated
      if (typeof window !== 'undefined') {
        localStorage.removeItem('adminSessionActive');
      }
      router.push('/admin-login'); // Redirect to admin login if not authenticated
    } else if (status === 'authenticated') {
      // If this is explicitly an admin session but user doesn't have admin role
      if (isAdminSessionActive && session?.user?.role !== 'ADMIN') {
        // Display a warning before redirecting
        alert('Admin session has expired or been replaced. Redirecting to user dashboard.');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('adminSessionActive');
        }
        router.push('/dashboard');
      }
      // If this is a regular user session that navigated to admin page
      else if (!isAdminSessionActive && session?.user?.role !== 'ADMIN') {
        router.push('/dashboard');
      }
    }
  }, [session, status, router]);

  // Show a loading state while session is being checked
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user is not authenticated or not an admin, the useEffect will handle redirection
  if (status === 'unauthenticated' || (session?.user?.role !== 'ADMIN')) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-6">
        <Link href="/admin" className="mr-4">
          <FiArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-3xl font-bold">Payment Management</h1>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <PaymentVerification />
      </div>
    </div>
  );
}