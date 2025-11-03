// components/UserLayout.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { UserSidebar } from '@/components/ui/UserSidebar';
import { UserHeader } from '@/components/ui/UserHeader';
import { FusionXSidebar } from '@/components/ui/FusionXSidebar';
import  Button  from '@/components/ui/Button';
import ThemeColorToggle from '@/components/ui/ThemeColorToggle';
import MobileBottomNav from '@/components/ui/MobileBottomNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { FiHome, FiTrendingUp, FiDollarSign, FiUser, FiLogOut, FiCreditCard, FiActivity, FiGrid, FiSettings, FiShare2, FiPieChart, FiMenu, FiArrowLeft } from 'react-icons/fi';
import MobileHamburgerMenu from '@/components/ui/MobileHamburgerMenu';

interface UserLayoutProps {
  children: React.ReactNode;
}

const UserLayout: React.FC<UserLayoutProps> = ({ children }) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
       <nav className="flex-1 space-y-2 p-4">
         {navigationItems.map((item) => (
           <Link
             key={item.path}
             href={item.path}
             title={item.label}
             aria-label={item.label}
             className={`flex items-center justify-center rounded-lg w-12 h-12 text-sm transition-colors fx-3d-card ${
               pathname === item.path.split('?')[0] || (item.path.includes('strategies') && pathname.startsWith('/strategies'))
                 ? 'text-white'
                 : 'text-gray-700 dark:text-gray-300'
             }`}
           >
             <span className="fx-3d-icon">{item.icon}</span>
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

  // ── Render (FusionX Style Layout) ─────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#0e1726] text-white overflow-x-hidden">
      {/* FusionX Sidebar - Desktop Only */}
      {!isMobile && <FusionXSidebar onLogout={handleLogout} />}

      {/* Main Content */}
      <div className="flex flex-col flex-1 md:ml-16 ml-0">
        {/* Header with onboarding steps */}
        <header className="sticky top-0 z-50 h-14 md:h-16 bg-[#0e1726] border-b border-[#1b2e4b] px-4 md:px-6 flex items-center justify-between overflow-x-hidden">
          <div className="flex items-center space-x-3">
            {isMobile && (
              <button
                className="md:hidden fx-3d-card p-2 rounded-lg"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                title="Open menu"
              >
                <span className="fx-3d-icon"><FiMenu className="h-5 w-5" /></span>
              </button>
            )}
            <div className="flex items-center">
              <Image src="/financial-growth.svg" alt="FusionX" width={22} height={22} className="mr-2" />
              <h1 className="text-lg md:text-xl font-semibold text-[#00d09c]">Copy Trade</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {(pathname?.startsWith('/strategies/') && pathname !== '/strategies') && (
              <Button
                variant="outline"
                size="sm"
                className="fx-3d-card px-2 py-1 h-8 w-8 flex items-center justify-center"
                aria-label="Back"
                title="Back"
                onClick={() => router.push('/strategies')}
              >
                <span className="fx-3d-icon"><FiArrowLeft className="h-4 w-4" /></span>
              </Button>
            )}

            {isMobile && (
              <Button
                variant="default"
                size="sm"
                className="md:hidden fx-3d-card"
                onClick={handleLogout}
                aria-label="Logout"
                title="Logout"
              >
                <span className="fx-3d-icon">
                  <FiLogOut className="h-5 w-5" />
                </span>
              </Button>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className={`flex-1 bg-[#0e1726] p-4 md:p-6 ${isMobile ? 'pb-24' : ''} overflow-x-hidden`}>
          <div className="w-full">
            {children}
          </div>
        </main>
        
        {/* Footer */}
        <footer className="py-3 px-6 text-xs text-gray-400 border-t border-[#1b2e4b] overflow-x-hidden">
          <div className="flex justify-between items-center">
            <p className="text-[10px]">Stock Market Investments are subject to market risk. Please read the offer documents carefully before investing. Past performances are no guarantee of future returns. This content is solely for educational purposes only.</p>
            <div className="text-[#00d09c] text-[10px]">
              Disclaimer
            </div>
          </div>
        </footer>

        {/* Mobile Hamburger Menu Drawer */}
        {isMobile && (
          <MobileHamburgerMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            onLogout={handleLogout}
          />
        )}

        {/* Mobile Bottom Navigation removed for mobile-only redesign; use hamburger menu instead */}
      </div>
    </div>
  );
};

export default UserLayout;