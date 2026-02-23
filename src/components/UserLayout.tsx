// components/UserLayout.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Montserrat } from 'next/font/google';
import { UserSidebar } from '@/components/ui/UserSidebar';
import { UserHeader } from '@/components/ui/UserHeader';
import Button from '@/components/ui/Button';
import ThemeColorToggle from '@/components/ui/ThemeColorToggle';
import { useIsMobile } from '@/hooks/use-mobile';
import Switch from '@/components/ui/switch';
import {
  FiHome,
  FiTrendingUp,
  FiDollarSign,
  FiUser,
  FiLogOut,
  FiCreditCard,
  FiActivity,
  FiGrid,
  FiSettings,
  FiShare2,
  FiPieChart,
  FiMenu,
  FiArrowLeft,
  FiBell,
  FiHeadphones,
  FiFacebook,
  FiTwitter,
  FiInstagram,
  FiYoutube,
  FiLinkedin,
  FiMail,
  FiPhone,
  FiMessageCircle
} from 'react-icons/fi';
import MobileHamburgerMenu from '@/components/ui/MobileHamburgerMenu';
import { COUNTRY_OPTIONS } from '@/utils/countries';

interface UserLayoutProps {
  children: React.ReactNode;
}

const COOKIE_PREFERENCES_KEY = 'cookie_preferences';

type CookieSettings = {
  necessary: boolean;
  analytical: boolean;
  marketing: boolean;
  targeting: boolean;
};

const defaultCookieSettings: CookieSettings = {
  necessary: false,
  analytical: false,
  marketing: false,
  targeting: false,
};

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['500', '500']
});

const UserLayout: React.FC<UserLayoutProps> = ({ children }) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [notifList, setNotifList] = useState<Array<{ id: string; message: string; createdAt?: string; href?: string }>>([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [publicMenuOpen, setPublicMenuOpen] = useState(false);
  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const [cookieSettings, setCookieSettings] = useState<CookieSettings>(defaultCookieSettings);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(COOKIE_PREFERENCES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setCookieSettings({
        necessary: typeof parsed.necessary === 'boolean' ? parsed.necessary : false,
        analytical: !!parsed.analytical,
        marketing: !!parsed.marketing,
        targeting: !!parsed.targeting,
      });
    } catch {
    }
  }, []);

  const saveCookiePreferences = (settings: CookieSettings) => {
    if (typeof window === 'undefined') return;
    try {
      const toSave = {
        necessary: settings.necessary,
        analytical: settings.analytical,
        marketing: settings.marketing,
        targeting: settings.targeting,
      };
      localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(toSave));
    } catch {
    }
  };

  const handleAcceptAllCookies = () => {
    const settings: CookieSettings = {
      necessary: true,
      analytical: true,
      marketing: true,
      targeting: true,
    };
    setCookieSettings(settings);
    saveCookiePreferences(settings);
    setCookieModalOpen(false);
  };

  const handleAcceptNecessaryCookies = () => {
    const settings: CookieSettings = {
      necessary: true,
      analytical: false,
      marketing: false,
      targeting: false,
    };
    setCookieSettings(settings);
    saveCookiePreferences(settings);
    setCookieModalOpen(false);
  };

  const handleSaveCookieSettings = () => {
    const settings: CookieSettings = {
      ...cookieSettings,
    };
    setCookieSettings(settings);
    saveCookiePreferences(settings);
    setCookieModalOpen(false);
  };

  const allCookiesEnabled =
    cookieSettings.necessary &&
    cookieSettings.analytical &&
    cookieSettings.marketing &&
    cookieSettings.targeting;

  const handleLogout = useCallback(async () => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
        localStorage.clear();
        localStorage.setItem('force_logout', 'true');
      }
      await signOut({ callbackUrl: '/', redirect: true });
    } catch {
      router.push('/');
    }
  }, [router]);

  // ── Auth redirect ─────────────────────────────────────
  useEffect(() => {
    const isPublic = ['/', '/about', '/login', '/signup'].includes(pathname || '') || pathname?.startsWith('/strategies');
    if (status === 'unauthenticated' && !isPublic) {
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`);
    }
  }, [status, router, pathname]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (typeof window === 'undefined') return;
    try {
      const forced = localStorage.getItem('force_logout');
      if (forced === 'true') {
        localStorage.removeItem('force_logout');
        signOut({ callbackUrl: '/', redirect: true });
      }
    } catch {
    }
  }, [status]);

  // ── Account enabled check (unchanged) ───────────────────
  useEffect(() => {
    const checkUserStatus = async () => {
      if (session?.user?.id) {
        try {
          let res = await fetch(`/api/profile`, { cache: 'no-store' });
          if (res.status === 401) {
            await new Promise(r => setTimeout(r, 800));
            res = await fetch(`/api/profile`, { cache: 'no-store' });
            if (res.status === 401) {
              await handleLogout();
              return;
            }
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
  }, [session?.user?.id, status, router, handleLogout]);

  useEffect(() => {
    let timer: any;
    const loadDismissed = (): Set<string> => {
      try {
        const raw = localStorage.getItem('notif_dismissed_ids');
        if (!raw) return new Set<string>();
        const arr = JSON.parse(raw);
        return new Set<string>(Array.isArray(arr) ? arr : []);
      } catch {
        return new Set<string>();
      }
    };
    const saveDismissed = (ids: Set<string>) => {
      try {
        localStorage.setItem('notif_dismissed_ids', JSON.stringify(Array.from(ids)));
      } catch { }
    };
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
          .map(m => ({ id: `tx-${m.id}`, message: `${m.admin_message} ${m.admin_message_status ? `(${m.admin_message_status})` : ''}`, createdAt: m.updated_at || m.created_at, href: '/profile/billing' }));

        const runList: any[] = runData?.strategies || [];
        const runMessages = runList
          .filter(r => typeof (r as any).adminStatus === 'string' && (r as any).adminStatus.trim().length > 0)
          .map(r => {
            const s = ((r as any).adminStatus as string).toLowerCase();
            const label = s === 'running' ? 'Marked running' : s === 'in-process' ? 'Processing started' : s.startsWith('wrong-account') ? 'Wrong account details' : s;
            return { id: `run-${(r as any).id}`, message: `Strategy ${(r as any).name}: ${label}`, createdAt: (r as any).updatedAt, href: '/strategies?view=deployed' };
          });

        const all = [...txMessages, ...runMessages]
          .filter(m => m.message && m.message.trim().length > 0)
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, 10);

        const dismissed = loadDismissed();
        const filtered = all.filter(n => !dismissed.has(n.id));
        setNotifCount(filtered.length);
        setNotifList(filtered);
      } catch {
        setNotifCount(0);
        setNotifList([]);
      }
    };
    loadUserNotifications();
    timer = setInterval(loadUserNotifications, 10000);
    return () => timer && clearInterval(timer);
  }, [session?.user?.id]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
      </div>
    );
  }


  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
    { id: 'topmasters', label: 'Top Masters', path: '/strategies?view=explore' },
    { id: 'copier', label: 'Copier', path: '/strategies?view=deployed' },
    { id: 'billing', label: 'Billing', path: '/billing' },
    { id: 'profile', label: 'Profile', path: '/profile' },
  ];

  const isAuthenticatedUser = status === 'authenticated' && !!session?.user;

  // ── Render (Top Navigation, HFM-like Theme) ─────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-white text-gray-900">
      {/* Main Content */}
      <div className="flex flex-col flex-1">
        {/* Top Navigation */}
        <header className="sticky top-0 z-50 h-24 bg-black text-white border-b border-[#111] px-4 md:px-8 flex items-center justify-between relative">
          <div className="flex items-center space-x-3">
            {isMobile && (
              pathname.startsWith('/strategies') && !isAuthenticatedUser ? (
                <button
                  className="md:hidden p-2 rounded-lg border border-[#1b3a5b] bg-transparent text-white"
                  onClick={() => setPublicMenuOpen(v => !v)}
                  aria-label="Open menu"
                  title="Open menu"
                >
                  <FiMenu className="h-5 w-5 text-white" />
                </button>
              ) : isAuthenticatedUser ? (
                <button
                  className="md:hidden p-2 rounded-lg border border-[#1b3a5b] bg-transparent text-white"
                  onClick={() => setMenuOpen(true)}
                  aria-label="Open menu"
                  title="Open menu"
                >
                  <FiMenu className="h-5 w-5 text-white" />
                </button>
              ) : null
            )}
            <div className="hidden md:flex items-center">
              <Image
                src="/Signals Copy - Logo.png"
                alt="Signals Copy"
                width={280}
                height={80}
                className="mr-3 object-contain"
                quality={100}
                priority
              />
            </div>
            {/* Mobile Centered Logo */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 
                md:hidden flex justify-center items-center pointer-events-none">
  <Image
    src="https://logo-img1122.s3.ap-south-1.amazonaws.com/Signals+Copy+(1).svg"
    alt="Signals Copy"
    width={550}
    height={160}
    className="block max-w-[70%] max-h-16 object-contain"
    quality={100}
    priority
  />
</div>


          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4">
            {(status as string) === 'unauthenticated' ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="px-4 py-1 rounded-full text-sm font-medium text-gray-300 hover:text-white hover:bg-[#1f2933] transition-colors"
                >
                  Home
                </Link>
                <Link
                  href="/about"
                  className="px-4 py-1 rounded-full text-sm font-medium text-gray-300 hover:text-white hover:bg-[#1f2933] transition-colors"
                >
                  About Us
                </Link>
                <Link
                  href="/strategies"
                  className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${pathname === '/strategies'
                      ? 'bg-[#374151] text-white'
                      : 'text-gray-300 hover:text-white hover:bg-[#1f2933]'
                    }`}
                >
                  Copy Trading
                </Link>
              </div>
            ) : (
              navigationItems.map((item) => {
                const basePath = item.path.split('?')[0];
                const isStrategiesItem = basePath === '/strategies';
                const viewParam = searchParams.get('view');

                let active = false;
                if (isStrategiesItem && pathname.startsWith('/strategies') && pathname !== '/strategies/running') {
                  if (item.id === 'copier') {
                    active = viewParam === 'deployed';
                  } else if (item.id === 'topmasters') {
                    active = viewParam !== 'deployed';
                  }
                } else if (!isStrategiesItem) {
                  active = pathname === basePath;
                }

                return (
                  <Link
                    key={item.id}
                    href={item.path}
                    title={item.label}
                    aria-label={item.label}
                    className={`${montserrat.className} px-5 py-2 rounded-full text-base font-semibold transition-colors ${active
                        ? 'bg-[#374151] text-white'
                        : 'text-gray-300 hover:text-white hover:bg-[#1f2933]'
                      }`}
                  >
                    {item.label}
                  </Link>
                );
              })
            )}
          </nav>

          <div className="flex items-center gap-4 md:gap-7">
            {(status as string) === 'unauthenticated' ? (
              <Link href="/login" className="flex items-center gap-2 text-white bg-blue-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Login
              </Link>
            ) : (
              <>
                {(pathname?.startsWith('/strategies/') && pathname !== '/strategies') && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-2 py-1 h-8 w-8 flex items-center justify-center border border-[#1b3a5b] text-white hover:bg-[#1b3a5b]"
                    aria-label="Back"
                    title="Back"
                    onClick={() => router.push('/strategies')}
                  >
                    <FiArrowLeft className="h-4 w-4 text-white" />
                  </Button>
                )}

                {!isMobile && (
                  <div className="flex items-center justify-center">
                    {(() => {
                      const userCountryName = (session?.user as any)?.country;
                      const country = COUNTRY_OPTIONS.find(c => c.name === userCountryName) || COUNTRY_OPTIONS.find(c => c.iso === 'in');
                      const iso = country?.iso || 'in';
                      return (
                        <img
                          src={`https://flagcdn.com/w80/${iso.toLowerCase()}.png`}
                          alt={country?.name || 'Country'}
                          className="w-10 h-10 object-cover rounded-full"
                        />
                      );
                    })()}
                  </div>
                )}

                <div className="flex items-center gap-2 md:gap-4">
                  {!isMobile && (
                    <Link
                      href="/contact"
                      className="text-white hover:text-gray-200 transition-colors flex items-center justify-center"
                      aria-label="Support"
                      title="Support"
                    >
                      <FiHeadphones className="h-6 w-6" />
                    </Link>
                  )}

                  {/* Notifications */}
                  <div className="relative flex items-center">
                    <button
                      className="text-white hover:text-gray-200 transition-colors flex items-center justify-center"
                      aria-label="Notifications"
                      title="Notifications"
                      onClick={() => setNotifOpen(v => !v)}
                    >
                      <FiBell className="h-5 w-5 md:h-6 md:w-6" />
                      {notifCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                          {notifCount > 9 ? '9+' : notifCount}
                        </span>
                      )}
                    </button>
                    {notifOpen && (
                      <div className="fixed right-4 top-12 md:top-16 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-[9999]">
                        <div className="p-3 border-b border-gray-200 text-sm font-semibold flex items-center justify-between">
                          <span className="text-black">Notifications</span>
                          {notifList.length > 0 && (
                            <button
                              className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-100 transition-colors text-black"
                              onClick={() => {
                                const ids = new Set<string>(notifList.map(n => n.id));
                                try {
                                  const existingRaw = localStorage.getItem('notif_dismissed_ids');
                                  const existing = new Set<string>(existingRaw ? JSON.parse(existingRaw) : []);
                                  ids.forEach(id => existing.add(id));
                                  localStorage.setItem('notif_dismissed_ids', JSON.stringify(Array.from(existing)));
                                } catch { }
                                setNotifList([]);
                                setNotifCount(0);
                              }}
                              aria-label="Clear all notifications"
                              title="Clear all"
                            >
                              Clear all
                            </button>
                          )}
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {notifList.length === 0 ? (
                            <div className="p-3 text-xs text-gray-500">No new notifications</div>
                          ) : notifList.map(n => (
                            <button
                              key={n.id}
                              className="w-full text-left p-3 text-xs border-b border-gray-200 hover:bg-gray-50 transition-colors"
                              onClick={() => {
                                try {
                                  const existingRaw = localStorage.getItem('notif_dismissed_ids');
                                  const existing = new Set<string>(existingRaw ? JSON.parse(existingRaw) : []);
                                  existing.add(n.id);
                                  localStorage.setItem('notif_dismissed_ids', JSON.stringify(Array.from(existing)));
                                } catch { }
                                setNotifList(prev => prev.filter(x => x.id !== n.id));
                                setNotifCount(prev => Math.max(0, prev - 1));
                                if (n.href) {
                                  router.push(n.href);
                                  setNotifOpen(false);
                                }
                              }}
                            >
                              <div className="text-gray-700">{n.message}</div>
                              <div className="text-[10px] text-gray-500 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* User Profile Icon */}
                <div className="relative">
                  <button
                    className="text-white hover:text-gray-200 transition-colors"
                    aria-label="User menu"
                    title="User menu"
                    onClick={() => setUserMenuOpen(v => !v)}
                  >
                    <div className="w-9 h-9 md:w-13 md:h-13 rounded-full bg-[#3998FF] flex items-center justify-center overflow-hidden">
                      <Image
                        src={(session?.user as any)?.image || '/strategy-icon.svg'}
                        alt="User"
                        width={50}
                        height={50}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-12 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#3998FF] flex items-center justify-center overflow-hidden">
                          <Image
                            src={(session?.user as any)?.image || '/strategy-icon.svg'}
                            alt="User avatar"
                            width={40}
                            height={40}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">
                            {session?.user?.name || 'User'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {session?.user?.email}
                          </div>
                        </div>
                      </div>
                      {session?.user?.id && (
                        <div className="px-4 py-2 flex items-center justify-between gap-2 border-b border-gray-100">
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] uppercase tracking-wide text-gray-400">User ID</div>
                            <div className="text-xs font-mono text-gray-700 truncate">{session.user.id}</div>
                          </div>
                          <button
                            type="button"
                            className="flex items-center justify-center px-2 py-1 text-xs font-medium text-blue-600 border border-blue-100 rounded-md hover:bg-blue-50 transition-colors"
                            onClick={() => {
                              if (typeof navigator !== 'undefined' && (navigator as any).clipboard && session?.user?.id) {
                                (navigator as any).clipboard.writeText(session.user.id as string).catch(() => { });
                              }
                            }}
                            aria-label="Copy user ID"
                            title="Copy user ID"
                          >
                            Copy
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
                        onClick={() => {
                          setUserMenuOpen(false);
                          router.push('/strategies?view=explore');
                        }}
                        aria-label="Top Masters"
                        title="Top Masters"
                      >
                        <span>Top Masters</span>
                        <FiTrendingUp className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-gray-50 transition-colors flex items-center gap-3 border-t border-gray-100"
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleLogout();
                        }}
                        aria-label="Logout"
                        title="Logout"
                      >
                        <FiLogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </header>

        {isMobile && pathname.startsWith('/strategies') && publicMenuOpen && (
          <div className="md:hidden bg-black border-b border-[#111] px-4 py-3 space-y-2">
            <Link
              href={isAuthenticatedUser ? '/dashboard' : '/'}
              className="block text-sm font-medium text-gray-200 hover:text-white"
            >
              Home
            </Link>
            <Link
              href="/about"
              className="block text-sm font-medium text-gray-200 hover:text-white"
            >
              About Us
            </Link>
            <Link
              href="/strategies"
              className={`block text-sm font-medium ${pathname === '/strategies'
                  ? 'text-white border-l-2 border-[#00d09c] pl-2'
                  : 'text-gray-200 hover:text-white'
                }`}
            >
              Copy Trading
            </Link>
            <Link
              href="/login"
              className="block text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md text-center px-3 py-2"
            >
              Login
            </Link>
          </div>
        )}

        {/* Main Content */}
        <main className={`flex-1 bg-gray-50 p-4 md:p-6 ${isMobile ? 'pb-24' : ''} overflow-x-hidden`}>
          <div className="w-full max-w-[1200px] mx-auto">
            {children}
          </div>
        </main>

        <footer className="bg-[#050608] text-gray-300 border-t border-[#111]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-16">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Image
                    src="/Signals Copy - Logo.png"
                    alt="Signals Copy"
                    width={240}
                    height={72}
                    className="object-contain"
                    quality={100}
                  />
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-3">Download Signals Copy App</p>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/app-coming-soon"
                      className="flex items-center gap-2 rounded-md border border-gray-500 px-3 py-2 text-[11px] font-medium hover:border-white hover:text-white transition-colors"
                    >
                      <span className="text-xs">App Store</span>
                    </Link>
                    <Link
                      href="/app-coming-soon"
                      className="flex items-center gap-2 rounded-md border border-gray-500 px-3 py-2 text-[11px] font-medium hover:border-white hover:text-white transition-colors"
                    >
                      <span className="text-xs">Android APK</span>
                    </Link>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">Find us on</p>
                  <div className="flex items-center gap-3 text-gray-400">
                    <a href="#" aria-label="Facebook" className="hover:text-white">
                      <FiFacebook className="h-4 w-4" />
                    </a>
                    <a href="#" aria-label="Twitter" className="hover:text-white">
                      <FiTwitter className="h-4 w-4" />
                    </a>
                    <a href="#" aria-label="Instagram" className="hover:text-white">
                      <FiInstagram className="h-4 w-4" />
                    </a>
                    <a href="#" aria-label="YouTube" className="hover:text-white">
                      <FiYoutube className="h-4 w-4" />
                    </a>
                    <a href="#" aria-label="LinkedIn" className="hover:text-white">
                      <FiLinkedin className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Quick Links</h3>
                <ul className="space-y-3 text-sm">
                  <li>
                    <Link
                      href={isAuthenticatedUser ? '/dashboard' : '/'}
                      className="text-gray-400 hover:text-white"
                    >
                      Home
                    </Link>
                  </li>
                  <li>
                    <Link href="/strategies" className="text-gray-400 hover:text-white">
                      Strategies
                    </Link>
                  </li>
                  <li>
                    <Link href="/login" className="text-gray-400 hover:text-white">
                      Login
                    </Link>
                  </li>
                  <li>
                    <Link href="/signup" className="text-gray-400 hover:text-white">
                      Sign Up
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="text-gray-400 hover:text-white">
                      Terms &amp; Conditions
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Resources</h3>
                <ul className="space-y-3 text-sm">
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white">
                      Blog
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white">
                      Market News
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white">
                      Learning Center
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white">
                      API Documentation
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Contact us</h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2">
                    <FiMail className="h-4 w-4 text-red-500" />
                    <a href="mailto:support@signalscopy.com" className="text-gray-300 hover:text-white">
                      support@signalscopy.com
                    </a>
                  </li>
                  <li className="flex items-center gap-2">
                    <FiPhone className="h-4 w-4 text-red-500" />
                    <a href="tel:+440000000000" className="text-gray-300 hover:text-white">
                      +44 0000 000 000
                    </a>
                  </li>
                  <li className="flex items-center gap-2">
                    <FiMessageCircle className="h-4 w-4 text-red-500" />
                    <span className="text-gray-300">Live Support</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-14 border-t border-gray-700 pt-8 text-[11px] leading-relaxed space-y-4 text-gray-400">
              <p className="space-x-3">
                <span className="font-semibold text-gray-200">Privacy Policy</span>
                <span className="font-semibold text-gray-200">Legal Documentation</span>
                <button
                  type="button"
                  onClick={() => setCookieModalOpen(true)}
                  className="font-semibold text-gray-200 hover:text-white underline-offset-4 hover:underline"
                >
                  Cookies
                </button>
              </p>
              <p>
                Trading leveraged products such as Forex and Derivatives may not be suitable for all investors as they
                carry a high degree of risk to your capital. Please ensure that you fully understand the risks involved,
                taking into account your investment objectives and level of experience, before trading, and if necessary,
                seek independent advice.
              </p>
              <p>
                Signals Copy does not offer services to residents of certain jurisdictions where trading or investment
                activities may be restricted or prohibited by local law.
              </p>
              <p className="text-center text-gray-500 pt-3">
                &copy; {new Date().getFullYear()} Signals Copy. All rights reserved.
              </p>
            </div>
          </div>
        </footer>

        {/* Mobile Hamburger Menu Drawer */}
        {isMobile && isAuthenticatedUser && (
          <MobileHamburgerMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            onLogout={handleLogout}
          />
        )}

        {cookieModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-start bg-black/60">
            <div className="relative h-full w-full max-w-md bg-[#111827] text-gray-100 shadow-2xl overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                <div>
                  <h2 className="text-lg font-semibold tracking-wide">How we use cookies</h2>
                  <p className="mt-1 text-xs text-gray-400">
                    We use cookies to provide the services and features offered on our site and to improve your
                    experience. You can choose which types of cookies to allow.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCookieModalOpen(false)}
                  className="ml-4 rounded-full p-1 text-gray-400 hover:text-white hover:bg-white/10"
                  aria-label="Close cookie settings"
                >
                  ×
                </button>
              </div>

              <div className="px-6 py-4 border-b border-gray-700 flex gap-3">
                <Button
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-sm font-semibold"
                  onClick={handleAcceptAllCookies}
                  disabled={allCookiesEnabled}
                >
                  Accept All
                </Button>
                <Button
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-sm font-semibold"
                  onClick={handleAcceptNecessaryCookies}
                >
                  Accept Necessary
                </Button>
              </div>

              <div className="px-6 py-5 space-y-4 text-xs leading-relaxed">
                <div className="flex items-center justify-between">
                  <div className="space-y-1 pr-4">
                    <p className="text-sm font-semibold">Necessary cookies</p>
                    <p className="text-[11px] text-gray-400">
                      Essential cookies required for the correct functioning of the website and to keep you logged in.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px]">
                    <span className={cookieSettings.necessary ? 'text-green-400' : 'text-gray-400'}>
                      {cookieSettings.necessary ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={cookieSettings.necessary}
                      onCheckedChange={(checked) =>
                        setCookieSettings((prev) => ({ ...prev, necessary: !!checked }))
                      }
                    />
                  </div>
                </div>

                <div className="h-px bg-gray-800" />

                <div className="flex items-center justify-between">
                  <div className="space-y-1 pr-4">
                    <p className="text-sm font-semibold">Analytical cookies</p>
                    <p className="text-[11px] text-gray-400">
                      Help us measure and improve site performance via anonymous reporting of how users interact with
                      website content.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px]">
                    <span className={cookieSettings.analytical ? 'text-green-400' : 'text-gray-400'}>
                      {cookieSettings.analytical ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={cookieSettings.analytical}
                      onCheckedChange={(checked) =>
                        setCookieSettings((prev) => ({ ...prev, analytical: !!checked }))
                      }
                    />
                  </div>
                </div>

                <div className="h-px bg-gray-800" />

                <div className="flex items-center justify-between">
                  <div className="space-y-1 pr-4">
                    <p className="text-sm font-semibold">Marketing cookies</p>
                    <p className="text-[11px] text-gray-400">
                      Help us provide a more personalised user experience and more relevant ads based on analysis of
                      user activity.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px]">
                    <span className={cookieSettings.marketing ? 'text-green-400' : 'text-gray-400'}>
                      {cookieSettings.marketing ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={cookieSettings.marketing}
                      onCheckedChange={(checked) =>
                        setCookieSettings((prev) => ({ ...prev, marketing: !!checked }))
                      }
                    />
                  </div>
                </div>

                <div className="h-px bg-gray-800" />

                <div className="flex items-center justify-between">
                  <div className="space-y-1 pr-4">
                    <p className="text-sm font-semibold">Targeting cookies</p>
                    <p className="text-[11px] text-gray-400">
                      Used by our advertising partners to deliver personalised advertisements on other sites once
                      enabled.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px]">
                    <span className={cookieSettings.targeting ? 'text-green-400' : 'text-gray-400'}>
                      {cookieSettings.targeting ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={cookieSettings.targeting}
                      onCheckedChange={(checked) =>
                        setCookieSettings((prev) => ({ ...prev, targeting: !!checked }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6">
                <Button
                  className="w-full bg-[#00d09c] hover:bg-[#00b085] text-sm font-semibold"
                  onClick={handleSaveCookieSettings}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default UserLayout;
