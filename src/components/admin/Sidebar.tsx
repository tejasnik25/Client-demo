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
  FaChevronDown,
  FaChartBar,
  FaHdd
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
        ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white shadow-lg' 
        : 'text-gray-600 hover:bg-gray-100 hover:text-black'}`}
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
  const [expandNewStrategy, setExpandNewStrategy] = useState(() => pathname.startsWith('/admin/plan-usage/new-strategy'));
  const [expandRenewalStrategy, setExpandRenewalStrategy] = useState(() => pathname.startsWith('/admin/plan-usage/renewal-strategy'));

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col h-full text-gray-600">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#00d09c] to-[#7c3aed]">Stock Analysis</h1>
        <p className="text-xs text-gray-500 mt-1">Admin Panel</p>
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
          label="Analytics Dashboard" 
          active={pathname === '/admin/analytics'} 
        />
        <NavItem 
          href="/admin/strategy" 
          icon={<FaChartBar size={18} />} 
          label="Strategy Management" 
          active={pathname === '/admin/strategy'} 
        />
        <NavItem 
          href="/admin/servers" 
          icon={<FaHdd size={18} />} 
          label="Server Management" 
          active={pathname === '/admin/servers'} 
        />
        <div className={`rounded-lg ${pathname.startsWith('/admin/payments') ? 'bg-gray-100' : ''}`}>
          <div className={`flex items-center justify-between px-4 py-3 text-sm rounded-lg cursor-pointer ${pathname.startsWith('/admin/payments') 
            ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' 
            : 'text-gray-600 hover:bg-gray-100'}`}
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
              <Link href="/admin/payments/pending" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/payments/pending' ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Pending Transactions</Link>
              <Link href="/admin/payments/approved" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/payments/approved' ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Approved Transactions</Link>
              <Link href="/admin/payments/rejected" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/payments/rejected' ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Rejected Transactions</Link>
              <div className="mt-1">
                <div className="flex items-center justify-between px-3 py-2 text-sm rounded-lg">
                  <Link href="/admin/payments/renewal" className="text-gray-600">Renewal</Link>
                  <button aria-label="Toggle Renewal" onClick={() => setExpandRenewal(v => !v)} className="p-1 rounded hover:bg-black/10 text-gray-600">
                    <FaChevronDown size={12} className={`transition-transform ${expandRenewal ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {expandRenewal && (
                  <div className="ml-6 space-y-1">
                    <Link href="/admin/payments/renewal/pending" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/payments/renewal/pending' ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Pending</Link>
                    <Link href="/admin/payments/renewal/approved" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/payments/renewal/approved' ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Approved</Link>
                    <Link href="/admin/payments/renewal/rejected" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/payments/renewal/rejected' ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Rejected</Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className={`rounded-lg ${pathname.startsWith('/admin/plan-usage') ? 'bg-gray-100' : ''}`}>
          <div className={`flex items-center justify-between px-4 py-3 text-sm rounded-lg cursor-pointer ${pathname.startsWith('/admin/plan-usage') 
            ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' 
            : 'text-gray-600 hover:bg-gray-100'}`}
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
              <Link href="/admin/plan-usage" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/plan-usage' ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Report</Link>
              <Link href="/admin/plan-usage/total-running-strategy" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/plan-usage/total-running-strategy' ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Total Running Strategy</Link>
              <Link href="/admin/plan-usage/total-disconnected-strategy" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/plan-usage/total-disconnected-strategy' ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Total Disconnected Strategy</Link>
              <div className="mt-1">
                <div className="flex items-center justify-between px-3 py-2 text-sm rounded-lg">
                  <Link href="/admin/plan-usage/new-strategy" className="text-gray-600">New Strategy</Link>
                  <button aria-label="Toggle New Strategy" onClick={() => setExpandNewStrategy(v => !v)} className="p-1 rounded hover:bg-black/10 text-gray-600">
                    <FaChevronDown size={12} className={`transition-transform ${expandNewStrategy ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {expandNewStrategy && (
                  <div className="ml-6 space-y-1">
                    <Link href="/admin/plan-usage/new-strategy/pending-new-strategy" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/plan-usage/new-strategy/pending-new-strategy' ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Pending</Link>
                    <Link href="/admin/plan-usage/new-strategy/approved-new-strategy" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/plan-usage/new-strategy/approved-new-strategy' ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Approved</Link>
                  </div>
                )}
              </div>
              <div className="mt-1">
                <div className="flex items-center justify-between px-3 py-2 text-sm rounded-lg">
                  <Link href="/admin/plan-usage/renewal-strategy" className="text-gray-600">Renewal Strategy</Link>
                  <button aria-label="Toggle Renewal Strategy" onClick={() => setExpandRenewalStrategy(v => !v)} className="p-1 rounded hover:bg-black/10 text-gray-600">
                    <FaChevronDown size={12} className={`transition-transform ${expandRenewalStrategy ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {expandRenewalStrategy && (
                  <div className="ml-6 space-y-1">
                    <Link href="/admin/plan-usage/renewal-strategy/pending-renewal-strategy" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/plan-usage/renewal-strategy/pending-renewal-strategy' ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Pending</Link>
                    <Link href="/admin/plan-usage/renewal-strategy/approved-renewal-strategy" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/plan-usage/renewal-strategy/approved-renewal-strategy' ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Approved</Link>
                  </div>
                )}
              </div>
              <Link href="/admin/plan-usage/modification-strategy" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/plan-usage/modification-strategy' ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Modification Strategy</Link>
              <Link href="/admin/plan-usage/modification" className={`block px-3 py-2 text-sm rounded-lg ${pathname === '/admin/plan-usage/modification' ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Modifications</Link>
            </div>
          )}
        </div>
      </nav>
      
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-2 text-sm text-white rounded-lg bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00c08c] hover:to-[#00a075] transition-all duration-300"
        >
          <FaSignOutAlt size={18} className="mr-3" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
