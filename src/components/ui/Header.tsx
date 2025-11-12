'use client';

import Link from 'next/link';

export function Header() {
  return (
    <header className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold">
          Copy Trade
        </Link>
        <nav className="hidden md:flex space-x-4">
          <Link href="/dashboard" className="mr-4">
            Dashboard
          </Link>
          <Link href="/strategies">
            Strategies
          </Link>
        </nav>
      </div>
    </header>
  );
}