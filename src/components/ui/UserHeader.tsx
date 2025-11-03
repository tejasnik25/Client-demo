'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { FiBell, FiSearch } from 'react-icons/fi';
import ThemeColorToggle from '@/components/ui/ThemeColorToggle';

export function UserHeader() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [searchTerm, setSearchTerm] = useState('');

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
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-4 px-6 flex items-center justify-between">
      <div className="flex items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mr-6">
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
            className="bg-gray-100 dark:bg-gray-700 border-none text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5"
            placeholder="Search strategies, transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="relative">
          <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <span className="fx-3d-icon">
              <FiBell size={20} />
            </span>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">2</span>
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