"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { FaTimes } from "react-icons/fa";

type AdminMobileMenuProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function AdminMobileMenu({ isOpen, onClose }: AdminMobileMenuProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!isOpen}
        onClick={onClose}
        className={`fixed inset-0 bg-black/40 transition-opacity duration-200 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        } z-40`}
      />

      {/* Drawer */}
      <nav
        className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-gray-200 transform transition-transform duration-200 z-50 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Admin Menu</h2>
            <p className="text-xs text-gray-500">Stock Analysis</p>
          </div>
          <button
            aria-label="Close menu"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
          >
            <FaTimes size={16} />
          </button>
        </div>

        <div className="p-2 space-y-1">
          <MobileLink href="/admin" label="Users" active={pathname === "/admin"} onClick={onClose} />
          <MobileLink href="/admin/analytics" label="Analytics" active={pathname === "/admin/analytics"} onClick={onClose} />
          <SectionTitle title="Payments" />
          <MobileLink href="/admin/payments" label="Overview" active={pathname === "/admin/payments"} onClick={onClose} />
          <MobileLink href="/admin/payments/pending" label="Pending" active={pathname === "/admin/payments/pending"} onClick={onClose} />
          <MobileLink href="/admin/payments/approved" label="Approved" active={pathname === "/admin/payments/approved"} onClick={onClose} />
          <MobileLink href="/admin/payments/rejected" label="Rejected" active={pathname === "/admin/payments/rejected"} onClick={onClose} />
          <SectionTitle title="Renewal" subtle />
          <MobileLink href="/admin/payments/renewal/pending" label="Pending" active={pathname === "/admin/payments/renewal/pending"} onClick={onClose} />
          <MobileLink href="/admin/payments/renewal/approved" label="Approved" active={pathname === "/admin/payments/renewal/approved"} onClick={onClose} />
          <MobileLink href="/admin/payments/renewal/rejected" label="Rejected" active={pathname === "/admin/payments/renewal/rejected"} onClick={onClose} />
          <SectionTitle title="Plan Usage" />
          <MobileLink href="/admin/plan-usage" label="Report" active={pathname === "/admin/plan-usage"} onClick={onClose} />
          <MobileLink href="/admin/plan-usage/total-running-strategy" label="Total Running Strategy" active={pathname === "/admin/plan-usage/total-running-strategy"} onClick={onClose} />
          <MobileLink href="/admin/plan-usage/total-disconnected-strategy" label="Total Disconnected Strategy" active={pathname === "/admin/plan-usage/total-disconnected-strategy"} onClick={onClose} />
          <MobileLink href="/admin/plan-usage/new-strategy" label="New Strategy" active={pathname === "/admin/plan-usage/new-strategy" && !pathname.includes('/pending-new-strategy') && !pathname.includes('/approved-new-strategy')} onClick={onClose} />
          <SectionTitle title="New Strategy" subtle />
          <MobileLink href="/admin/plan-usage/new-strategy/pending-new-strategy" label="Pending" active={pathname === "/admin/plan-usage/new-strategy/pending-new-strategy"} onClick={onClose} />
          <MobileLink href="/admin/plan-usage/new-strategy/approved-new-strategy" label="Approved" active={pathname === "/admin/plan-usage/new-strategy/approved-new-strategy"} onClick={onClose} />
          <MobileLink href="/admin/plan-usage/renewal-strategy" label="Renewal Strategy" active={pathname === "/admin/plan-usage/renewal-strategy" && !pathname.includes('/pending-renewal-strategy') && !pathname.includes('/approved-renewal-strategy')} onClick={onClose} />
          <SectionTitle title="Renewal Strategy" subtle />
          <MobileLink href="/admin/plan-usage/renewal-strategy/pending-renewal-strategy" label="Pending" active={pathname === "/admin/plan-usage/renewal-strategy/pending-renewal-strategy"} onClick={onClose} />
          <MobileLink href="/admin/plan-usage/renewal-strategy/approved-renewal-strategy" label="Approved" active={pathname === "/admin/plan-usage/renewal-strategy/approved-renewal-strategy"} onClick={onClose} />
          <MobileLink href="/admin/plan-usage/modification-strategy" label="Modification Strategy" active={pathname === "/admin/plan-usage/modification-strategy"} onClick={onClose} />
          <MobileLink href="/admin/plan-usage/modification" label="Modifications" active={pathname === "/admin/plan-usage/modification"} onClick={onClose} />
          <MobileLink href="/admin/referrals" label="Referrals" active={pathname === "/admin/referrals"} onClick={onClose} />
          <MobileLink href="/admin/database" label="Database" active={pathname === "/admin/database"} onClick={onClose} />
          <MobileLink href="/admin/settings" label="Settings" active={pathname === "/admin/settings"} onClick={onClose} />

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-2 w-full px-3 py-2 text-sm rounded-md bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00c08c] hover:to-[#00a075] text-white transition-all duration-300"
          >
            Logout
          </button>
        </div>
      </nav>
    </>
  );
}

function SectionTitle({ title, subtle = false }: { title: string; subtle?: boolean }) {
  return (
    <div className={`px-3 py-2 text-xs uppercase tracking-wide ${subtle ? "text-gray-400" : "text-gray-500"}`}>
      {title}
    </div>
  );
}

function MobileLink({ href, label, active, onClick }: { href: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block px-3 py-2 text-sm rounded-md transition-colors ${
        active ? "bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {label}
    </Link>
  );
}