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
        className={`fixed top-0 left-0 h-full w-72 bg-[#0e1726] border-r border-[#1b2e4b] transform transition-transform duration-200 z-50 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#1b2e4b]">
          <div>
            <h2 className="text-base font-semibold text-white">Admin Menu</h2>
            <p className="text-xs text-gray-400">Stock Analysis</p>
          </div>
          <button
            aria-label="Close menu"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-white/5 text-gray-300"
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
          <MobileLink href="/admin/plan-usage" label="Plan Usage Report" active={pathname === "/admin/plan-usage"} onClick={onClose} />
          <MobileLink href="/admin/referrals" label="Referrals" active={pathname === "/admin/referrals"} onClick={onClose} />
          <MobileLink href="/admin/database" label="Database" active={pathname === "/admin/database"} onClick={onClose} />
          <MobileLink href="/admin/settings" label="Settings" active={pathname === "/admin/settings"} onClick={onClose} />

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-2 w-full px-3 py-2 text-sm rounded-md bg-white/10 hover:bg-white/15 text-gray-200"
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
    <div className={`px-3 py-2 text-xs uppercase tracking-wide ${subtle ? "text-gray-400" : "text-gray-300"}`}>
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
        active ? "bg-gradient-to-r from-[#00d09c] to-[#7c3aed] text-white" : "text-gray-300 hover:bg-[#1b2e4b]/40"
      }`}
    >
      {label}
    </Link>
  );
}