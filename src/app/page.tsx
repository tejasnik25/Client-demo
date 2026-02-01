"use client"

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  FiArrowRight,
  FiBarChart2,
  FiShield,
  FiTrendingUp,
  FiFacebook,
  FiTwitter,
  FiInstagram,
  FiYoutube,
  FiLinkedin,
  FiMail,
  FiPhone,
  FiMessageCircle,
} from "react-icons/fi";
import { Strategy } from "@/types/strategy";

interface StrategyCard {
  id: string;
  name: string;
  description: string;
  performance: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  imageUrl: string;
  parameters?: Record<string, string>;
}

export default function Home() {
  const { data: session } = useSession();
  const [strategies, setStrategies] = useState<StrategyCard[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        setLoadingStrategies(true);
        const res = await fetch('/api/strategies', { credentials: 'include' });
        const data = await res.json();
        const list: StrategyCard[] = (data.strategies || []).slice(0, 4);
        setStrategies(list);
      } catch (e) {
        // silently ignore for landing page
      } finally {
        setLoadingStrategies(false);
      }
    };
    fetchStrategies();
  }, []);
  return (
    <main className="min-h-screen">
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-black border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-28">
            <div className="flex items-center gap-3">
              <Image 
                src="/Signals Copy - Logo.png" 
                alt="Signals Copy" 
                width={250} 
                height={100} 
                className="object-contain" 
                quality={100}
                priority
              />
            </div>
            <div className="hidden md:flex items-center gap-8">
              <Link
                href={session ? '/dashboard' : '/'}
                className="text-black-700 hover:text-blue-600 font-semibold text-lg"
              >
                Home
              </Link>
              <Link href="/about" className="text-black-700 hover:text-blue-600 font-semibold text-lg">
                About Us
              </Link>
              <Link href="/strategies" className="text-black-700 hover:text-blue-600 font-semibold text-lg">
                Copy Trading
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login" className="hidden sm:inline-flex items-center gap-2 text-white bg-blue-600 px-4 py-2 rounded-md text-m font-semibold hover:bg-blue-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
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
                <Link
                  href={session ? '/dashboard' : '/'}
                  className="block px-3 py-2 text-base font-semibold text-white-700 hover:bg-white-100 rounded-md"
                >
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

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-white to-gray-100 py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
                <span className="block text-gray-900">Smart Stock Analysis</span>
                <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Powered by AI</span>
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl">
                Make informed investment decisions with our advanced stock analysis platform. Get real-time insights, predictive analytics, and personalized recommendations.
              </p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Link href={session ? '/dashboard' : '/signup'} className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition duration-300 ease-in-out transform hover:-translate-y-1">
                  Get Started Free
                  <svg xmlns="http://www.w3.org/2000/svg" className="ml-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </Link>
                <a href="#features" className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-md hover:shadow-lg transition duration-300 ease-in-out transform hover:-translate-y-1">
                  Learn More
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl filter blur-3xl opacity-70 animate-pulse"></div>
              <Image
                src="/stock-chart.svg"
                alt="Stock Analysis Chart"
                width={800}
                height={600}
                className="relative rounded-3xl shadow-2xl transform hover:scale-105 transition duration-500 ease-in-out"
                priority
              />
            </div>
          </div>
        </div>
        
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
          <div className="absolute top-96 -left-20 w-72 h-72 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-24 right-1/2 w-72 h-72 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
        </div>
      </section>

      {/* Strategies Preview Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Strategies</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Explore pre-built, backtested strategies. Log in to view full details.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {loadingStrategies ? (
              Array(4).fill(0).map((_, i) => (
                <div key={`skeleton-${i}`} className="bg-white rounded-xl p-6 shadow min-h-[240px]">
                  <div className="h-32 bg-gray-100 animate-pulse rounded mb-4" />
                  <div className="h-5 bg-gray-100 animate-pulse rounded mb-2 w-3/4" />
                  <div className="h-4 bg-gray-100 animate-pulse rounded w-1/2" />
                </div>
              ))
            ) : strategies.length === 0 ? (
              <div className="col-span-full text-center text-gray-600">No strategies yet</div>
            ) : (
              strategies.map((s) => (
                <div key={s.id} className="bg-white rounded-xl p-6 shadow hover:shadow-lg transition min-h-[240px] flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{s.name}</h3>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${s.riskLevel === 'High' ? 'text-red-600 bg-red-100' : s.riskLevel === 'Medium' ? 'text-yellow-700 bg-yellow-100' : 'text-green-700 bg-green-100'}`}>{s.riskLevel} Risk</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{s.description}</p>
                  <div className="flex items-center gap-3 text-xs mb-4 flex-wrap">
                    {s.parameters && Object.entries(s.parameters).slice(0,3).map(([k,v]) => (
                      <span key={k} className="px-2 py-1 rounded bg-gray-100 text-gray-700">{k}: {v}</span>
                    ))}
                    <span className={`px-2 py-1 rounded ${s.performance >= 0 ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>Perf: {s.performance >= 0 ? '+' : ''}{s.performance}%</span>
                  </div>
                  <div className="mt-auto flex justify-between items-center">
                    <Link href={(session && (session.user as any)?.role === 'USER') ? '/strategies' : '/login?redirect=/strategies'} className="text-blue-600 hover:underline">View All</Link>
                    <Link href={(session && (session.user as any)?.role === 'USER') ? '/strategies' : '/login?redirect=/strategies'} className="text-sm text-gray-700 hover:text-blue-600">{(session && (session.user as any)?.role === 'USER') ? 'More info' : 'Login to view info'}</Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Powerful Features</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our platform combines cutting-edge technology with user-friendly interfaces to help you make better investment decisions.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-gray-50 rounded-xl p-8 shadow-lg hover:shadow-xl transition duration-300 ease-in-out transform hover:-translate-y-2">
              <div className="w-16 h-16 mx-auto mb-6">
                <Image
                  src="/financial-analysis.svg"
                  alt="Real-time Analysis"
                  width={200}
                  height={200}
                  className="w-full h-full"
                />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3 text-center">Real-time Analysis</h3>
              <p className="text-gray-600 text-center">
                Get instant insights with real-time stock data and market trends to make timely decisions.
              </p>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-gray-50 rounded-xl p-8 shadow-lg hover:shadow-xl transition duration-300 ease-in-out transform hover:-translate-y-2">
              <div className="w-16 h-16 mx-auto mb-6">
                <Image
                  src="/ai-analysis.svg"
                  alt="AI-Powered Predictions"
                  width={200}
                  height={200}
                  className="w-full h-full"
                />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3 text-center">AI-Powered Predictions</h3>
              <p className="text-gray-600 text-center">
                Our advanced AI algorithms analyze patterns and predict market movements with high accuracy.
              </p>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-gray-50 rounded-xl p-8 shadow-lg hover:shadow-xl transition duration-300 ease-in-out transform hover:-translate-y-2">
              <div className="w-16 h-16 mx-auto mb-6">
                <Image
                  src="/financial-growth.svg"
                  alt="Portfolio Optimization"
                  width={200}
                  height={200}
                  className="w-full h-full"
                />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3 text-center">Portfolio Optimization</h3>
              <p className="text-gray-600 text-center">
                Optimize your investment portfolio with personalized recommendations based on your goals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="cta" className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your Investment Strategy?</h2>
          <p className="text-xl mb-8 max-w-3xl mx-auto">Join thousands of investors who are already using our platform to make smarter investment decisions.</p>
          <Link href="/signup" className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-gray-100 shadow-lg hover:shadow-xl transition duration-300 ease-in-out transform hover:-translate-y-1">
            Start Your Free Trial
            <svg xmlns="http://www.w3.org/2000/svg" className="ml-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </section>

      <footer className="bg-[#050608] text-gray-300 border-t border-[#111]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-16">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Image
                  src="/Signals Copy - Logo.png"
                  alt="Signals Copy"
                  width={280}
                  height={80}
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
                    href={session ? '/dashboard' : '/'}
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

      {/* Add animation keyframes */}
      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </main>
  )
}
