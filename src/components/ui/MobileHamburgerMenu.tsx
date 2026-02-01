'use client';

import Link from 'next/link';
import { FiLogOut } from 'react-icons/fi';
import { usePathname, useSearchParams } from 'next/navigation';
import { Montserrat } from 'next/font/google';

type MobileHamburgerMenuProps = {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
};

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['500', '600'],
});

export default function MobileHamburgerMenu({ open, onClose, onLogout }: MobileHamburgerMenuProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const items = [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
    { id: 'topmasters', label: 'Top Masters', path: '/strategies?view=explore' },
    { id: 'copier', label: 'Copier', path: '/strategies?view=deployed' },
    { id: 'billing', label: 'Billing', path: '/billing' },
    { id: 'profile', label: 'Profile', path: '/profile' },
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
            const basePath = item.path.split('?')[0];
            const isStrategiesItem = basePath === '/strategies';
            const viewParam = searchParams.get('view');

            let isActive = false;
            if (isStrategiesItem && pathname?.startsWith('/strategies') && pathname !== '/strategies/running') {
              if (item.id === 'copier') {
                isActive = viewParam === 'deployed';
              } else if (item.id === 'topmasters') {
                isActive = viewParam !== 'deployed';
              }
            } else if (!isStrategiesItem) {
              isActive = pathname === basePath || pathname?.startsWith(basePath);
            }

            return (
              <Link
                key={item.id}
                href={item.path}
                title={item.label}
                aria-label={item.label}
                className={`${montserrat.className} flex items-center gap-3 px-3 py-2 rounded-xl transition-colors fx-3d-card ${
                  isActive ? 'text-[#00d09c] bg-[#1b2e4b]' : 'text-gray-300 hover:bg-[#1b2e4b]/50'
                }`}
                onClick={onClose}
              >
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-[#1b2e4b]">
          <button
            onClick={() => { onLogout(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:opacity-90 transition-opacity fx-3d-card"
          >
            <span className="fx-3d-icon"><FiLogOut className="h-5 w-5" /></span>
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
