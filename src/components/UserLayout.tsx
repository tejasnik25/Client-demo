'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';

import { SidebarProvider } from '@/components/ui/Sidebar';
import Button from '@/components/ui/Button';
import ThemeColorToggle from '@/components/ui/ThemeColorToggle';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import VisuallyHidden from '@/components/ui/VisuallyHidden';
import { useIsMobile } from '@/hooks/use-mobile';

import { FiHome, FiBarChart2, FiDollarSign, FiUser, FiLogOut, FiTrendingUp, FiMenu } from 'react-icons/fi';

interface UserLayoutProps {
  children: React.ReactNode;
}

const UserLayout: React.FC<UserLayoutProps> = ({ children }) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [walletBalance, setWalletBalance] = useState<number>(0);

  // Handle authentication state
  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Fetch user wallet balance from database
  useEffect(() => {
    const fetchWalletBalance = async () => {
      if (session?.user?.id) {
        try {
          const response = await fetch(`/api/users?id=${encodeURIComponent(session.user.id)}`);
          if (!response.ok) {
            if (response.status === 404) {
              setWalletBalance(0);
              return;
            }
            throw new Error(`Failed to fetch user: ${response.status}`);
          }
          const data = await response.json();
          if (data.user && typeof data.user.wallet_balance === 'number') {
            setWalletBalance(data.user.wallet_balance);
          } else {
            setWalletBalance(0);
          }
        } catch (error) {
          console.error('Error fetching wallet balance:', error);
        }
      }
    };

    if (status === 'authenticated' && session?.user?.id) {
      fetchWalletBalance();
      const interval = setInterval(fetchWalletBalance, 3000);
      return () => clearInterval(interval);
    }
  }, [session?.user?.id, status]);

  // Show loading spinner while checking authentication
  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
      });
      sessionStorage.clear();
      localStorage.clear();
      router.push('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      router.push('/login');
    }
  };

  // Navigation items configuration
  const navigationItems = [
    { id: 'dashboard', icon: <FiHome className="h-5 w-5" />, label: 'Dashboard', path: '/dashboard' },
    { id: 'strategies', icon: <FiTrendingUp className="h-5 w-5" />, label: 'Strategies', path: '/strategies' },
    { id: 'wallet', icon: <FiDollarSign className="h-5 w-5" />, label: 'Wallet', path: '/wallet' },
    { id: 'profile', icon: <FiUser className="h-5 w-5" />, label: 'Profile', path: '/dashboard?tab=profile' },
  ];

  // Desktop sidebar component
  const DesktopSidebar = () => (
    <div className="hidden md:flex w-64 flex-col border-r h-full bg-background transition-all duration-300">
      <div className="flex items-center mb-8 px-4 py-6">
        <Image src="/stock-chart.svg" alt="Logo" width={40} height={40} />
        <h1 className="text-xl font-bold ml-2">StockAnalysis</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto px-2">
        <div className="space-y-1">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 ${pathname === item.path.split('?')[0] ? 'bg-primary text-primary-foreground shadow-md transform hover:translate-x-1' : 'hover:bg-muted hover:shadow-sm transform hover:-translate-y-1'}
                focus:outline-none focus:ring-2 focus:ring-primary/30 active:scale-98`}
              aria-label={`Navigate to ${item.label}`}
            >
              <span className="mr-3 transition-transform duration-200 group-hover:scale-110">{item.icon}</span>
              <span className="font-medium transition-colors duration-200">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      <div className="p-4 border-t">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm">Theme</span>
          <ThemeColorToggle />
        </div>
        <Button variant="primary" className="w-full transition-all duration-200 hover:shadow-lg active:scale-98" onClick={handleLogout}>
          <FiLogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  // Mobile sidebar menu content
  const MobileSidebarContent = () => (
    <div className="h-full flex flex-col">
      <div className="flex items-center mb-8 p-4 border-b">
        <Image src="/stock-chart.svg" alt="Logo" width={40} height={40} />
        <h1 className="text-xl font-bold ml-2">StockAnalysis</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                router.push(item.path);
              }}
              className={`w-full flex items-center p-3 rounded-lg transition-colors ${pathname === item.path.split('?')[0] ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <span className="mr-3">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      <div className="p-4 border-t">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm">Theme</span>
          <ThemeColorToggle />
        </div>
        <Button variant="primary" className="w-full" onClick={handleLogout}>
          <FiLogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex flex-col min-h-screen bg-background">
        {/* Mobile navigation */}
        {isMobile && (
          <header className="sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-md">
            <h1 className="text-xl font-bold">StockAnalysis</h1>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="primary" className="p-2" aria-label="Open menu">
                  <FiMenu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-xs p-0">
                <SheetTitle className="sr-only">Mobile Menu</SheetTitle>
                <MobileSidebarContent />
              </SheetContent>
            </Sheet>
          </header>
        )}
        
        <div className="flex flex-1">
          {/* Desktop sidebar */}
          <DesktopSidebar />
          
          {/* Main content - full width */}
          <main className="flex-1 overflow-auto">
            <div className="w-full max-w-none py-4 md:py-6 space-y-4 md:space-y-6">
              {!isMobile && (
                <div className="flex justify-between items-center px-4 sm:px-0 mb-6">
                  <h1 className="text-2xl lg:text-3xl font-bold">
                    {pathname ? (pathname.split('/').pop() || 'Dashboard').charAt(0).toUpperCase() + 
                     (pathname.split('/').pop() || 'Dashboard').slice(1) : 'Dashboard'}
                  </h1>
                  <div className="flex items-center space-x-4 gap-2">
                    <span className="text-sm text-muted-foreground">
                      Welcome, {session?.user?.name || 'User'}
                    </span>
                    <div className="flex items-center bg-primary/10 px-3 py-1 rounded-full">
                      <svg className="h-4 w-4 text-primary mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M12 22V12" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M20 7L12 12L4 7" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      <span className="text-sm font-medium">{walletBalance.toFixed(2)} Tokens</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Page content */}
              <div className="relative z-10 w-full max-w-none">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default UserLayout;