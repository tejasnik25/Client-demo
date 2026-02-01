'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { FaBell, FaSearch, FaBars } from 'react-icons/fa';
import ThemeColorToggle from '@/components/ui/ThemeColorToggle';
import AdminMobileMenu from '@/components/admin/MobileMenu';
import Image from 'next/image';

export function Header() {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-black text-white border-b border-[#111] h-24 px-4 sm:px-6 flex items-center justify-between">
      {/* Mobile hamburger */}
      <div className="flex items-center gap-3">
        <button
          aria-label="Open menu"
          onClick={() => setIsMenuOpen(true)}
          className="inline-flex md:hidden p-2 rounded-md bg-transparent text-white hover:bg-[#1b3a5b] border border-[#1b3a5b]"
        >
          <FaBars size={18} />
        </button>
        <div className="hidden md:block">
          <Image 
            src="/Signals Copy - Logo.png" 
            alt="Signals Copy" 
            width={200} 
            height={80} 
            className="object-contain" 
            quality={100}
            priority
          />
        </div>
      </div>

      <div className="flex items-center w-full max-w-md">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <FaSearch className="w-4 h-4 text-gray-300" />
          </div>
          <input
            type="text"
            className="bg-[#1b3a5b] border border-[#2a4a72] text-white placeholder:text-gray-300 text-sm rounded-lg focus:ring-[#00d09c] focus:border-[#00d09c] block w-full pl-10 p-2.5"
            placeholder="Search users, payments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="relative">
          <button className="text-white hover:text-gray-200 border border-[#1b3a5b] rounded px-2 py-1 hover:border-[#00d09c] bg-transparent">
            <FaBell size={20} />
            <span className="absolute -top-1 -right-1 bg-[#00d09c] text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">3</span>
          </button>
        </div>
        
        <ThemeColorToggle />
        
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#00d09c] to-[#00b085] flex items-center justify-center text-white font-medium mr-2">
            {session?.user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {session?.user?.name || 'Admin'}
            </p>
            <p className="text-xs text-gray-300">
              Administrator
            </p>
          </div>
        </div>
      </div>
      <AdminMobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </header>
  );
}
