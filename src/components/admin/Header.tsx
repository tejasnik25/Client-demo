'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { FaBell, FaSearch, FaBars } from 'react-icons/fa';
import ThemeColorToggle from '@/components/ui/ThemeColorToggle';
import AdminMobileMenu from '@/components/admin/MobileMenu';

export function Header() {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-4 px-4 sm:px-6 flex items-center justify-between">
      {/* Mobile hamburger */}
      <div className="flex items-center gap-3">
        <button
          aria-label="Open menu"
          onClick={() => setIsMenuOpen(true)}
          className="inline-flex md:hidden p-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <FaBars size={18} />
        </button>
        <div className="hidden md:block text-sm text-gray-600 dark:text-gray-300">
          Admin Dashboard
        </div>
      </div>

      <div className="flex items-center w-full max-w-md">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <FaSearch className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </div>
          <input
            type="text"
            className="bg-gray-100 dark:bg-gray-700 border-none text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5"
            placeholder="Search users, payments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="relative">
          <button className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <FaBell size={20} />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">3</span>
          </button>
        </div>
        
        <ThemeColorToggle />
        
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium mr-2">
            {session?.user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {session?.user?.name || 'Admin'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Administrator
            </p>
          </div>
        </div>
      </div>
      <AdminMobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </header>
  );
}