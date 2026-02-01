
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  FiFacebook,
  FiTwitter,
  FiInstagram,
  FiYoutube,
  FiLinkedin,
  FiMail,
  FiPhone,
  FiMessageCircle,
} from 'react-icons/fi';

export default function AboutPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: session } = useSession();
  const homeHref = session ? '/dashboard' : '/';
  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-black border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-24">
            <div className="flex items-center gap-3">
              <Link href={homeHref}>
                <Image 
                  src="/Signals Copy - Logo.png" 
                  alt="Signals Copy" 
                  width={300} 
                  height={140} 
                  className="object-contain" 
                  quality={100}
                  priority
                />
              </Link>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <Link href={homeHref} className="text-black-700 hover:text-blue-600 font-semibold">
                Home
              </Link>
              <Link href="/about" className="text-black-700 hover:text-blue-600 font-semibold">
                About Us
              </Link>
              <Link href="/strategies" className="text-black-700 hover:text-blue-600 font-semibold">
                Copy Trading
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/login" className="hidden sm:inline-flex items-center gap-2 text-white bg-blue-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Login
              </Link>
              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                aria-label="Toggle navigation"
                onClick={() => setMobileMenuOpen((open) => !open)}
              >
                <span className="sr-only">Open main menu</span>
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200">
              <div className="py-3 space-y-2">
                <Link href={homeHref} className="block px-3 py-2 text-base font-semibold text-white-700 hover:bg-white-100 rounded-md">
                  Home
                </Link>
                <Link href="/about" className="block px-3 py-2 text-base font-semibold text-white-700 hover:bg-white-100 rounded-md">
                  About Us
                </Link>
                <Link href="/strategies" className="block px-3 py-2 text-base font-semibold text-white-700 hover:bg-white-100 rounded-md">
                  Copy Trading
                </Link>
                <Link href="/login" className="block px-3 py-2 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md text-center">
                  Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* About Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">About Us</h1>
          <p className="text-xl text-gray-600">
            We are dedicated to democratizing financial markets through innovative copy trading technology.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-20">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Mission</h2>
            <p className="text-lg text-gray-600 mb-6">
              Our mission is to empower investors of all levels to achieve their financial goals by connecting them with top-performing traders from around the world. We believe in transparency, security, and the power of community.
            </p>
            <p className="text-lg text-gray-600">
              By leveraging advanced AI and machine learning, we provide real-time insights and risk management tools to help you make informed decisions.
            </p>
          </div>
          <div className="relative h-96 rounded-2xl overflow-hidden shadow-xl">
             <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center text-white text-2xl font-bold">
               Building the Future of Trading
             </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Why Choose Us?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Verified Masters</h3>
              <p className="text-gray-600">All strategy providers undergo rigorous vetting and performance monitoring.</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Bank-Grade Security</h3>
              <p className="text-gray-600">Your funds and data are protected by state-of-the-art encryption and security protocols.</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Real-Time Execution</h3>
              <p className="text-gray-600">Experience low-latency trade copying to ensure you get the same prices as the masters.</p>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-[#050608] text-gray-300 border-t border-[#111] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-16">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Image
                  src="/Signals Copy - Logo.png"
                  alt="Signals Copy"
                  width={240}
                  height={72}
                  className="object-contain"
                  quality={100}
                />
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-3">Download Signals Copy App</p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/app-coming-soon"
                    className="flex items-center gap-2 rounded-md border border-gray-500 px-3 py-2 text-[11px] font-medium hover:border-white hover:text-white transition-colors"
                  >
                    <span className="text-xs">App Store</span>
                  </Link>
                  <Link
                    href="/app-coming-soon"
                    className="flex items-center gap-2 rounded-md border border-gray-500 px-3 py-2 text-[11px] font-medium hover:border-white hover:text-white transition-colors"
                  >
                    <span className="text-xs">Android APK</span>
                  </Link>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Find us on</p>
                <div className="flex items-center gap-3 text-gray-400">
                  <a href="#" aria-label="Facebook" className="hover:text-white">
                    <FiFacebook className="h-4 w-4" />
                  </a>
                  <a href="#" aria-label="Twitter" className="hover:text-white">
                    <FiTwitter className="h-4 w-4" />
                  </a>
                  <a href="#" aria-label="Instagram" className="hover:text-white">
                    <FiInstagram className="h-4 w-4" />
                  </a>
                  <a href="#" aria-label="YouTube" className="hover:text-white">
                    <FiYoutube className="h-4 w-4" />
                  </a>
                  <a href="#" aria-label="LinkedIn" className="hover:text-white">
                    <FiLinkedin className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Quick Links</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link
                    href={homeHref}
                    className="text-gray-400 hover:text-white"
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/strategies" className="text-gray-400 hover:text-white">
                    Strategies
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-gray-400 hover:text-white">
                    Login
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="text-gray-400 hover:text-white">
                    Sign Up
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-gray-400 hover:text-white">
                    Terms &amp; Conditions
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Resources</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#" className="text-gray-400 hover:text-white">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white">
                    Market News
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white">
                    Learning Center
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white">
                    API Documentation
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Contact us</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2">
                  <FiMail className="h-4 w-4 text-red-500" />
                  <a href="mailto:support@signalscopy.com" className="text-gray-300 hover:text-white">
                    support@signalscopy.com
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <FiPhone className="h-4 w-4 text-red-500" />
                  <a href="tel:+440000000000" className="text-gray-300 hover:text-white">
                    +44 0000 000 000
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <FiMessageCircle className="h-4 w-4 text-red-500" />
                  <span className="text-gray-300">Live Support</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-14 border-t border-gray-700 pt-8 text-[11px] leading-relaxed space-y-4 text-gray-400">
            <p className="space-x-3">
              <span className="font-semibold text-gray-200">Privacy Policy</span>
              <span className="font-semibold text-gray-200">Legal Documentation</span>
              <span className="font-semibold text-gray-200">Cookies</span>
            </p>
            <p>
              Trading leveraged products such as Forex and Derivatives may not be suitable for all investors as they
              carry a high degree of risk to your capital. Please ensure that you fully understand the risks involved,
              taking into account your investment objectives and level of experience, before trading, and if necessary,
              seek independent advice.
            </p>
            <p>
              Signals Copy does not offer services to residents of certain jurisdictions where trading or investment
              activities may be restricted or prohibited by local law.
            </p>
            <p className="text-center text-gray-500 pt-3">
              &copy; {new Date().getFullYear()} Signals Copy. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
