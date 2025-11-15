'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { 
  FaUsers, 
  FaChartLine, 
  FaCog, 
  FaDatabase, 
  FaSignOutAlt, 
  FaMoneyBillWave,
  FaNetworkWired,
  FaChevronDown
} from 'react-icons/fa';

type NavItemProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
};

const NavItem = ({ href, icon, label, active }: NavItemProps) => {
  return (
    <Link 
      href={href}
      className={`flex items-center px-4 py-3 text-sm rounded-lg transition-colors ${active 
        ? 'bg-blue-600 text-white' 
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
    >
      <span className="mr-3">{icon}</span>
      <span>{label}</span>
    </Link>
  );
};

export function Sidebar() {
  const pathname = usePathname();
  const [expandPayments, setExpandPayments] = useState(() => pathname.startsWith('/admin/payments'));
  const [expandRenewal, setExpandRenewal] = useState(() => pathname.startsWith('/admin/payments/renewal'));
  const [expandPlanUsage, setExpandPlanUsage] = useState(() => pathname.startsWith('/admin/plan-usage'));

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="hidden md:flex w-64 bg-[#0e1726] border-r border-[#1b2e4b] flex-col h-full text-gray-300">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#00d09c] to-[#7c3aed]">Stock Analysis</h1>
        <p className="text-xs text-gray-400 mt-1">Admin Panel</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <NavItem 
          href="/admin" 
          icon={<FaUsers size={18} />} 
          label="Users" 
          active={pathname === '/admin'} 
        />
        <NavItem 
          href="/admin/analytics" 
          icon={<FaChartLine size={18} />} 
          label="Analytics" 
          active={pathname === '/admin/analytics'} 
        />
        <div className={`rounded-lg ${pathname.startsWith('/admin/payments') ? 'bg-[#1b2e4b]/40' : ''}`}>
          <div className={`flex items-center justify-between px-4 py-3 text-sm rounded-lg cursor-pointer ${pathname.startsWith('/admin/payments') 
            ? 'bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white' 
            : 'text-gray-300 hover:bg-[#1b2e4b]/40'}`}
          >
            <Link href="/admin/payments" className="flex items-center">
              <span className="mr-3"><FaMoneyBillWave size={18} /></span>
              <span>Payments</span>
            </Link>
            <button aria-label="Toggle Payments" onClick={() => setExpandPayments(v => !v)} className="p-1 rounded hover:bg-black/10">
              <FaChevronDown size={14} className={`transition-transform ${expandPayments ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {expandPayments && (
            <div className="ml-8 mt-1 space-y-1">
              <Link href="/admin/payments/pending" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/payments/pending' ? 'bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white' : 'text-gray-300 hover:bg-[#1b2e4b]/40'}`}>Pending Transactions</Link>
              <Link href="/admin/payments/approved" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/payments/approved' ? 'bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white' : 'text-gray-300 hover:bg-[#1b2e4b]/40'}`}>Approved Transactions</Link>
              <Link href="/admin/payments/rejected" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/payments/rejected' ? 'bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white' : 'text-gray-300 hover:bg-[#1b2e4b]/40'}`}>Rejected Transactions</Link>
              <div className="mt-1">
                <div className="flex items-center justify-between px-3 py-2 text-sm rounded-lg">
                  <Link href="/admin/payments/renewal" className="text-gray-300">Renewal</Link>
                  <button aria-label="Toggle Renewal" onClick={() => setExpandRenewal(v => !v)} className="p-1 rounded hover:bg-black/10 text-gray-300">
                    <FaChevronDown size={12} className={`transition-transform ${expandRenewal ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {expandRenewal && (
                  <div className="ml-6 space-y-1">
                    <Link href="/admin/payments/renewal/pending" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/payments/renewal/pending' ? 'bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white' : 'text-gray-300 hover:bg-[#1b2e4b]/40'}`}>Pending</Link>
                    <Link href="/admin/payments/renewal/approved" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/payments/renewal/approved' ? 'bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white' : 'text-gray-300 hover:bg-[#1b2e4b]/40'}`}>Approved</Link>
                    <Link href="/admin/payments/renewal/rejected" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/payments/renewal/rejected' ? 'bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white' : 'text-gray-300 hover:bg-[#1b2e4b]/40'}`}>Rejected</Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className={`rounded-lg ${pathname.startsWith('/admin/plan-usage') ? 'bg-[#1b2e4b]/40' : ''}`}>
          <div className={`flex items-center justify-between px-4 py-3 text-sm rounded-lg cursor-pointer ${pathname.startsWith('/admin/plan-usage') 
            ? 'bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white' 
            : 'text-gray-300 hover:bg-[#1b2e4b]/40'}`}
            onClick={() => setExpandPlanUsage(v => !v)}
          >
            <Link href="/admin/plan-usage" className="flex items-center">
              <span className="mr-3"><FaChartLine size={18} /></span>
              <span>Plan Usage</span>
            </Link>
            <button aria-label="Toggle Plan Usage" className="p-1 rounded hover:bg-black/10">
              <FaChevronDown size={14} className={`transition-transform ${expandPlanUsage ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {expandPlanUsage && (
            <div className="ml-8 mt-1 space-y-1">
              <Link href="/admin/plan-usage" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/plan-usage' ? 'bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white' : 'text-gray-300 hover:bg-[#1b2e4b]/40'}`}>Report</Link>
              <Link href="/admin/plan-usage/modification" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/plan-usage/modification' ? 'bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white' : 'text-gray-300 hover:bg-[#1b2e4b]/40'}`}>Modifications</Link>
            </div>
          )}
        </div>
        <NavItem 
          href="/admin/referrals" 
          icon={<FaNetworkWired size={18} />} 
          label="Referrals" 
          active={pathname === '/admin/referrals'} 
        />
        <NavItem 
          href="/admin/database" 
          icon={<FaDatabase size={18} />} 
          label="Database" 
          active={pathname === '/admin/database'} 
        />
        <NavItem 
          href="/admin/settings" 
          icon={<FaCog size={18} />} 
          label="Settings" 
          active={pathname === '/admin/settings'} 
        />
      </nav>
      
      <div className="p-4 border-t border-[#1b2e4b]">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-2 text-sm text-gray-300 rounded-lg hover:bg-[#1b2e4b]/40 transition-colors"
        >
          <FaSignOutAlt size={18} className="mr-3" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}