// components/UserLayout.tsx
'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { SidebarProvider } from '@/components/ui/Sidebar';
import Button from '@/components/ui/Button';
import ThemeColorToggle from '@/components/ui/ThemeColorToggle';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { FiHome, FiTrendingUp, FiDollarSign, FiUser, FiLogOut, FiMenu } from 'react-icons/fi';

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
    { id: 'payments', icon: <FiDollarSign className="h-5 w-5" />, label: 'Payments', path: '/wallet/topup' },
    { id: 'profile', icon: <FiUser className="h-5 w-5" />, label: 'Profile', path: '/dashboard?tab=profile' },
  ];

  // ── Desktop Sidebar ─────────────────────────────────────
  const DesktopSidebar = () => (
    <aside className="flex w-20 flex-col h-screen bg-[#161d31] border-r border-[#3b4253] text-gray-200">
      {/* Logo */}
      <div className="flex items-center justify-center px-3 py-5">
        <Image src="/stock-chart.svg" alt="Logo" width={36} height={36} />
      </div>

      {/* Nav (icon-only) */}
      <nav className="flex-1 overflow-y-auto px-2">
        <div className="space-y-2">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              className={`group flex w-full items-center justify-center rounded-xl p-3 transition-all ${
                pathname === item.path.split('?')[0]
                  ? 'bg-[#7367f0] text-white shadow-md'
                  : 'text-gray-300 hover:bg-[#1f243a] hover:text-white'
              }`}
              aria-label={item.label}
            >
              <span className="transition-transform group-hover:scale-110">{item.icon}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Footer (empty) */}
      <div className="border-t border-[#3b4253] p-3">
        {/* Logout button removed and moved to header */}
      </div>
    </aside>
  );

  // ── Mobile Sidebar ──────────────────────────────────────
  const MobileSidebar = () => (
    <div className="flex h-full flex-col bg-[#161d31] text-white">
      <div className="flex items-center gap-2 border-b border-[#3b4253] p-4">
        <Image src="/stock-chart.svg" alt="Logo" width={40} height={40} />
        <h1 className="text-xl font-bold">FusionX</h1>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                pathname === item.path.split('?')[0]
                  ? 'bg-gradient-to-r from-[#6b59f7] to-[#7a6df4] text-white'
                  : 'text-gray-300 hover:bg-[#1f243a] hover:text-white'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="border-t border-[#3b4253] p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-gray-300">Theme</span>
          <ThemeColorToggle />
        </div>
        <Button
          onClick={handleLogout}
          className="w-full bg-[#7367f0] text-white hover:bg-[#5e50ee]"
        >
          <FiLogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen bg-[#0f1527]">
        {/* Mobile Header */}
        {isMobile && (
          <header className="sticky top-0 z-50 flex w-full items-center justify-between bg-[#283046] p-4 text-white">
            <h1 className="text-xl font-bold">FusionX</h1>
            <Sheet>
              <SheetTrigger asChild>
                <Button className="p-2 bg-[#7367f0] text-white hover:bg-[#5e50ee]">
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
        <DesktopSidebar />

        {/* Main Content – FULL WIDTH */}
        <main className="flex-1">
          {/* Desktop page header (title + welcome) */}
          {!isMobile && (
            <div className="flex items-center justify-between border-b border-[#283046] px-6 py-4">
              <h1 className="text-2xl font-bold text-white">
                {pathname
                  ? (pathname.split('/').pop() || 'Dashboard').charAt(0).toUpperCase() +
                    (pathname.split('/').pop() || 'Dashboard').slice(1)
                  : 'Dashboard'}
              </h1>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-300">
                  Welcome, {session?.user?.name || 'User'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-white"
                  onClick={handleLogout}
                >
                  <FiLogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Children – no padding, full width */}
          <div className="h-full w-full">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default UserLayout;