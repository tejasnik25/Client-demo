'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { FiBell, FiSearch, FiCreditCard } from 'react-icons/fi';
import ThemeColorToggle from '@/components/ui/ThemeColorToggle';

export function UserHeader() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    const fetchBalance = () => {
      if (session?.user?.id) {
        fetch('/api/profile', { cache: 'no-store' })
          .then(res => res.json())
          .then(data => {
            if (data?.success && typeof data.user?.wallet_balance === 'number') {
              setWalletBalance(data.user.wallet_balance);
            }
          })
          .catch(err => console.error('Failed to fetch wallet balance:', err));
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  // Get page title from pathname
  const getPageTitle = () => {
    if (pathname === '/dashboard') return 'Dashboard';
    if (pathname.startsWith('/strategies/running')) return 'Running Strategies';
    if (pathname.startsWith('/strategies')) return 'Strategies';
    if (pathname.startsWith('/wallet')) return 'Wallet';
    if (pathname.startsWith('/profile/billing')) return 'Billing';
    return 'Dashboard';
  };

  return (
    <header className="bg-white border-b border-gray-200 py-4 px-6 flex items-center justify-between">
      <div className="flex items-center">
        <h1 className="text-2xl font-bold text-gray-900 mr-6">
          {getPageTitle()}
        </h1>
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <span className="fx-3d-icon">
              <FiSearch className="w-4 h-4 text-gray-300" />
            </span>
          </div>
          <input
            type="text"
            className="bg-gray-100 border-none text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5 border border-red-500"
            placeholder="Search strategies, transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Wallet Balance Display */}
        {session?.user && (
          <button 
            onClick={() => router.push('/wallet')}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200 group"
          >
            <FiCreditCard className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
            <div className="flex flex-col items-start leading-none">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Wallet</span>
              <span className="text-sm font-black text-gray-900">
                {walletBalance !== null ? `$${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '...'}
              </span>
            </div>
          </button>
        )}

        <div className="relative">
          <button className="text-gray-500 hover:text-gray-700 border border-gray-200 rounded p-1.5 transition-colors">
            <span className="fx-3d-icon">
              <FiBell size={20} />
            </span>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center border-2 border-white">2</span>
          </button>
        </div>
        
        <ThemeColorToggle />
        
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium mr-2">
            {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {session?.user?.name || 'User'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Trader
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}