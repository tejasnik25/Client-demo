'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiGrid, FiTrendingUp, FiActivity, FiCreditCard, FiUser, FiSettings } from 'react-icons/fi';

type Props = { top?: boolean };

export default function MobileBottomNav({ top = false }: Props) {
  const pathname = usePathname();

  const items = [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: <FiGrid className="h-5 w-5" /> },
    { id: 'strategies', label: 'Strategies', path: '/strategies', icon: <FiTrendingUp className="h-5 w-5" /> },
    { id: 'running', label: 'Running', path: '/strategies/running', icon: <FiActivity className="h-5 w-5" /> },
    { id: 'billing', label: 'Billing', path: '/billing', icon: <FiCreditCard className="h-5 w-5" /> },
    { id: 'profile', label: 'Profile', path: '/profile', icon: <FiUser className="h-5 w-5" /> },
    { id: 'settings', label: 'Settings', path: '/settings', icon: <FiSettings className="h-5 w-5" /> },
  ];

  return (
    <nav
      className={
        top
          ? 'sticky top-0 left-0 right-0 z-50 bg-[#0e1726] border-b border-[#1b2e4b] py-2'
          : 'fixed bottom-0 left-0 right-0 z-50 bg-[#0e1726] border-t border-[#1b2e4b] py-2 safe-bottom'
      }
    >
      <div className="mx-auto max-w-full px-2 overflow-x-auto">
        <ul className="flex items-center gap-2 flex-nowrap">
          {items.map((item) => {
            const isActive = pathname === item.path || pathname?.startsWith(item.path);
            return (
              <li key={item.id}>
                <Link
                  href={item.path}
                  title={item.label}
                  aria-label={item.label}
                  className={`fx-3d-card w-11 h-11 rounded-xl flex items-center justify-center relative ${
                    isActive ? 'text-[#00d09c]' : 'text-gray-300'
                  }`}
                >
                  <span className="fx-3d-icon">{item.icon}</span>
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#00d09c] rounded" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}