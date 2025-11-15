// components/UserLayout.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { UserSidebar } from '@/components/ui/UserSidebar';
import { UserHeader } from '@/components/ui/UserHeader';
import { CopyTradeSidebar } from '@/components/ui/CopyTradeSidebar';
import  Button  from '@/components/ui/Button';
import ThemeColorToggle from '@/components/ui/ThemeColorToggle';
import MobileBottomNav from '@/components/ui/MobileBottomNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { FiHome, FiTrendingUp, FiDollarSign, FiUser, FiLogOut, FiCreditCard, FiActivity, FiGrid, FiSettings, FiShare2, FiPieChart, FiMenu, FiArrowLeft, FiBell } from 'react-icons/fi';
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
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [notifList, setNotifList] = useState<Array<{ id: string; message: string; createdAt?: string }>>([]);

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
          if (res.status === 401) {
            // Unauthorized, session might be expired, trigger logout
            handleLogout();
            return;
          }
          if (!res.ok && res.status !== 404) throw new Error(`API responded with ${res.status}`);
          const data = await res.json();
          if (data.user?.enabled === false) {
            await handleLogout();
          }
        } catch (e) {
          console.error('Error checking user status:', e);
        }
      }
    };

    if (status === 'authenticated' && session?.user?.id) {
      checkUserStatus();
      const id = setInterval(checkUserStatus, 30000); // Increased interval to 30s
      return () => clearInterval(id);
    }
  }, [session?.user?.id, status, router]);

  useEffect(() => {
    let timer: any;
    const loadUserNotifications = async () => {
      if (!session?.user?.id) return;
      try {
        const [txRes, runRes] = await Promise.all([
          fetch('/api/wallet/transactions', { cache: 'no-store' }),
          fetch('/api/strategies/running', { cache: 'no-store' }),
        ]);
        const txData = await txRes.json().catch(() => ({}));
        const runData = await runRes.json().catch(() => ({}));
        const txList: any[] = txData?.transactions || [];
        const myTx = txList.filter(t => t.user_id === session.user.id);
        const txMessages = myTx
          .filter(t => typeof t.admin_message === 'string' && t.admin_message.trim().length > 0)
          .map(m => ({ id: `tx-${m.id}`, message: `${m.admin_message} ${m.admin_message_status ? `(${m.admin_message_status})` : ''}`, createdAt: m.updated_at || m.created_at }));

        const runList: any[] = runData?.strategies || [];
        const runMessages = runList
          .filter(r => typeof (r as any).adminStatus === 'string' && (r as any).adminStatus.trim().length > 0)
          .map(r => {
            const s = ((r as any).adminStatus as string).toLowerCase();
            const label = s === 'running' ? 'Marked running' : s === 'in-process' ? 'Processing started' : s.startsWith('wrong-account') ? 'Wrong account details' : s;
            return { id: `run-${(r as any).id}`, message: `Strategy ${(r as any).name}: ${label}`, createdAt: (r as any).updatedAt };
          });

        const all = [...txMessages, ...runMessages]
          .filter(m => m.message && m.message.trim().length > 0)
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, 10);

        setNotifCount(all.length);
        setNotifList(all);
      } catch {
        setNotifCount(0);
        setNotifList([]);
      }
    };
    loadUserNotifications();
    timer = setInterval(loadUserNotifications, 10000);
    return () => timer && clearInterval(timer);
  }, [session?.user?.id]);

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
      {!isMobile && <CopyTradeSidebar onLogout={handleLogout} />}

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

            {/* Notifications */}
            <div className="relative">
              <button
                className="fx-3d-card px-2 py-1 h-8 w-8 flex items-center justify-center border border-[#1b2e4b]"
                aria-label="Notifications"
                title="Notifications"
                onClick={() => setNotifOpen(v => !v)}
              >
                <span className="fx-3d-icon"><FiBell className="h-4 w-4" /></span>
                {notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="fixed right-4 top-12 md:top-14 w-80 bg-[#161d31] border border-[#283046] rounded-xl shadow-lg z-[9999]">
                  <div className="p-3 border-b border-[#283046] text-sm font-semibold">Notifications</div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifList.length === 0 ? (
                      <div className="p-3 text-xs text-gray-400">No new notifications</div>
                    ) : notifList.map(n => (
                      <div key={n.id} className="p-3 text-xs border-b border-[#283046]">
                        <div className="text-gray-300">{n.message}</div>
                        <div className="text-[10px] text-gray-500 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

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