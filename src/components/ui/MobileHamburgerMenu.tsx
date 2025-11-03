'use client';

import Link from 'next/link';
import { FiGrid, FiTrendingUp, FiActivity, FiCreditCard, FiUser, FiSettings, FiLogOut } from 'react-icons/fi';
import { usePathname } from 'next/navigation';

type MobileHamburgerMenuProps = {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
};

export default function MobileHamburgerMenu({ open, onClose, onLogout }: MobileHamburgerMenuProps) {
  const pathname = usePathname();

  const items = [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: <FiGrid className="h-5 w-5" /> },
    { id: 'strategies', label: 'Strategies', path: '/strategies', icon: <FiTrendingUp className="h-5 w-5" /> },
    { id: 'running', label: 'Running', path: '/strategies/running', icon: <FiActivity className="h-5 w-5" /> },
    { id: 'billing', label: 'Billing', path: '/billing', icon: <FiCreditCard className="h-5 w-5" /> },
    { id: 'profile', label: 'Profile', path: '/profile', icon: <FiUser className="h-5 w-5" /> },
    { id: 'settings', label: 'Settings', path: '/settings', icon: <FiSettings className="h-5 w-5" /> },
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Drawer */}
      <div className="absolute left-0 top-0 bottom-0 w-[85vw] max-w-[320px] bg-[#0e1726] border-r border-[#1b2e4b] shadow-2xl fx-3d-card overflow-y-auto">
        <div className="p-4 border-b border-[#1b2e4b]">
          <div className="text-lg font-semibold">Menu</div>
          <div className="text-xs text-gray-400">Navigate</div>
        </div>

        <nav className="p-4 space-y-2">
          {items.map((item) => {
            const isActive = pathname === item.path || pathname?.startsWith(item.path);
            return (
              <Link
                key={item.id}
                href={item.path}
                title={item.label}
                aria-label={item.label}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors fx-3d-card ${
                  isActive ? 'text-[#00d09c] bg-[#1b2e4b]' : 'text-gray-300 hover:bg-[#1b2e4b]/50'
                }`}
                onClick={onClose}
              >
                <span className="fx-3d-icon">{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-[#1b2e4b]">
          <button
            onClick={() => { onLogout(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-300 hover:text-white hover:bg-[#1b2e4b]/50 transition-colors fx-3d-card"
          >
            <span className="fx-3d-icon"><FiLogOut className="h-5 w-5" /></span>
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}