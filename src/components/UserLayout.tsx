// components/UserLayout.tsx
'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { UserSidebar } from '@/components/ui/UserSidebar';
import { UserHeader } from '@/components/ui/UserHeader';
import Button from '@/components/ui/Button';
import ThemeColorToggle from '@/components/ui/ThemeColorToggle';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { FiHome, FiTrendingUp, FiDollarSign, FiUser, FiLogOut, FiMenu, FiCreditCard, FiActivity } from 'react-icons/fi';

interface UserLayoutProps {
  children: React.ReactNode;
}

const UserLayout: React.FC<UserLayoutProps> = ({ children }) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();

  // ── Auth redirect ─────────────────────────────────────
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`);
    }
  }, [status, router, pathname]);

  // ── Account enabled check (unchanged) ───────────────────
  useEffect(() => {
    const checkUserStatus = async () => {
      if (session?.user?.id) {
        try {
          const res = await fetch(`/api/users?id=${encodeURIComponent(session.user.id)}`);
          if (!res.ok && res.status !== 404) throw new Error();
          const data = await res.json();
          if (data.user?.enabled === false) {
            await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' });
            sessionStorage.clear();
            localStorage.clear();
            router.push('/login');
          }
        } catch (e) {
          console.error('Error checking user status:', e);
        }
      }
    };

    if (status === 'authenticated' && session?.user?.id) {
      checkUserStatus();
      const id = setInterval(checkUserStatus, 3000);
      return () => clearInterval(id);
    }
  }, [session?.user?.id, status, router]);

  // ── Loading ───────────────────────────────────────────
  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' });
      sessionStorage.clear();
      localStorage.clear();
      router.push('/');
    } catch {
      router.push('/');
    }
  };

  const navigationItems = [
    { id: 'dashboard', icon: <FiHome className="h-5 w-5" />, label: 'Dashboard', path: '/dashboard' },
    { id: 'strategies', icon: <FiTrendingUp className="h-5 w-5" />, label: 'Strategies', path: '/strategies' },
    { id: 'running', icon: <FiActivity className="h-5 w-5" />, label: 'Running Strategies', path: '/strategies/running' },
    { id: 'billing', icon: <FiCreditCard className="h-5 w-5" />, label: 'Billing', path: '/profile/billing' },
    { id: 'profile', icon: <FiUser className="h-5 w-5" />, label: 'Profile', path: '/dashboard?tab=profile' },
  ];

  // ── Desktop Sidebar (Admin Style) ─────────────────────────────────────
  const DesktopSidebar = () => (
    <UserSidebar onLogout={handleLogout} />
  );

  // ── Mobile Sidebar (Admin Style) ─────────────────────────────────────────────
  const MobileSidebar = () => (
    <div className="flex h-full flex-col bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-r from-blue-600 to-purple-600">
          <FiTrendingUp className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">FusionX</span>
      </div>

      {/* Navigation */}
       <nav className="flex-1 space-y-1 p-4">
         {navigationItems.map((item) => (
           <Link
             key={item.path}
             href={item.path}
             className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
               pathname === item.path.split('?')[0] || (item.path.includes('strategies') && pathname.startsWith('/strategies'))
                 ? 'bg-blue-600 text-white'
                 : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
             }`}
           >
             {item.icon}
             {item.label}
           </Link>
         ))}
       </nav>

      {/* Logout */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <Button
          variant="outline"
          className="w-full justify-start gap-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={handleLogout}
        >
          <FiLogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  // ── Render (Admin Style Layout) ─────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Mobile Header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">FusionX</h1>
          <Sheet>
            <SheetTrigger asChild>
              <Button className="p-2 bg-blue-600 text-white hover:bg-blue-700">
                <FiMenu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-xs p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <MobileSidebar />
            </SheetContent>
          </Sheet>
        </header>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && <DesktopSidebar />}

      {/* Main Content Area */}
      <div className={`flex flex-col flex-1 overflow-hidden ${isMobile ? 'pt-16' : ''}`}>
        {/* Desktop Header */}
        {!isMobile && <UserHeader />}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
};

export default UserLayout;