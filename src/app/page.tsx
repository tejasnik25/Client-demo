"use client"

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { FiArrowRight, FiBarChart2, FiShield, FiTrendingUp } from "react-icons/fi";
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
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/70 dark:bg-gray-900/60 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                StockAnalyzer
              </span>
            </div>
            {/* Primary Nav (removed for old design) */}
            <div className="hidden md:flex items-center gap-6"></div>
            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-white bg-blue-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                Login
              </Link>
              <Link href="/signup" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:from-blue-700 hover:to-purple-700 transition-colors">
                Sign Up
              </Link>
              <Link href="/admin-login" className="text-white bg-red-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors">
                Admin
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-white to-gray-100 dark:from-gray-900 dark:to-gray-800 py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
                <span className="block text-gray-900 dark:text-white">Smart Stock Analysis</span>
                <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Powered by AI</span>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl">
                Make informed investment decisions with our advanced stock analysis platform. Get real-time insights, predictive analytics, and personalized recommendations.
              </p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Link href={session ? '/dashboard' : '/signup'} className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition duration-300 ease-in-out transform hover:-translate-y-1">
                  Get Started Free
                  <svg xmlns="http://www.w3.org/2000/svg" className="ml-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </Link>
                <a href="#features" className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-base font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-md hover:shadow-lg transition duration-300 ease-in-out transform hover:-translate-y-1">
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
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">Strategies</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Explore pre-built, backtested strategies. Log in to view full details.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {loadingStrategies ? (
              Array(4).fill(0).map((_, i) => (
                <div key={`skeleton-${i}`} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow min-h-[240px]">
                  <div className="h-32 bg-gray-100 dark:bg-gray-700 animate-pulse rounded mb-4" />
                  <div className="h-5 bg-gray-100 dark:bg-gray-700 animate-pulse rounded mb-2 w-3/4" />
                  <div className="h-4 bg-gray-100 dark:bg-gray-700 animate-pulse rounded w-1/2" />
                </div>
              ))
            ) : strategies.length === 0 ? (
              <div className="col-span-full text-center text-gray-600 dark:text-gray-300">No strategies yet</div>
            ) : (
              strategies.map((s) => (
                <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow hover:shadow-lg transition min-h-[240px] flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{s.name}</h3>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${s.riskLevel === 'High' ? 'text-red-600 bg-red-100 dark:bg-red-900/30' : s.riskLevel === 'Medium' ? 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30' : 'text-green-700 bg-green-100 dark:bg-green-900/30'}`}>{s.riskLevel} Risk</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">{s.description}</p>
                  <div className="flex items-center gap-3 text-xs mb-4 flex-wrap">
                    {s.parameters && Object.entries(s.parameters).slice(0,3).map(([k,v]) => (
                      <span key={k} className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{k}: {v}</span>
                    ))}
                    <span className={`px-2 py-1 rounded ${s.performance >= 0 ? 'text-green-700 bg-green-100 dark:bg-green-900/30' : 'text-red-700 bg-red-100 dark:bg-red-900/30'}`}>Perf: {s.performance >= 0 ? '+' : ''}{s.performance}%</span>
                  </div>
                  <div className="mt-auto flex justify-between items-center">
                    <Link href={(session && (session.user as any)?.role === 'USER') ? '/strategies' : '/login?redirect=/strategies'} className="text-blue-600 dark:text-blue-400 hover:underline">View All</Link>
                    <Link href={(session && (session.user as any)?.role === 'USER') ? '/strategies' : '/login?redirect=/strategies'} className="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">{(session && (session.user as any)?.role === 'USER') ? 'More info' : 'Login to view info'}</Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">Powerful Features</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Our platform combines cutting-edge technology with user-friendly interfaces to help you make better investment decisions.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-8 shadow-lg hover:shadow-xl transition duration-300 ease-in-out transform hover:-translate-y-2">
              <div className="w-16 h-16 mx-auto mb-6">
                <Image
                  src="/financial-analysis.svg"
                  alt="Real-time Analysis"
                  width={200}
                  height={200}
                  className="w-full h-full"
                />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 text-center">Real-time Analysis</h3>
              <p className="text-gray-600 dark:text-gray-300 text-center">
                Get instant insights with real-time stock data and market trends to make timely decisions.
              </p>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-8 shadow-lg hover:shadow-xl transition duration-300 ease-in-out transform hover:-translate-y-2">
              <div className="w-16 h-16 mx-auto mb-6">
                <Image
                  src="/ai-analysis.svg"
                  alt="AI-Powered Predictions"
                  width={200}
                  height={200}
                  className="w-full h-full"
                />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 text-center">AI-Powered Predictions</h3>
              <p className="text-gray-600 dark:text-gray-300 text-center">
                Our advanced AI algorithms analyze patterns and predict market movements with high accuracy.
              </p>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-8 shadow-lg hover:shadow-xl transition duration-300 ease-in-out transform hover:-translate-y-2">
              <div className="w-16 h-16 mx-auto mb-6">
                <Image
                  src="/financial-growth.svg"
                  alt="Portfolio Optimization"
                  width={200}
                  height={200}
                  className="w-full h-full"
                />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 text-center">Portfolio Optimization</h3>
              <p className="text-gray-600 dark:text-gray-300 text-center">
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

      {/* Footer */}
      <footer className="bg-gray-100 dark:bg-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">StockAnalyzer</h3>
              <p className="text-gray-600 dark:text-gray-300">Making stock analysis accessible and intelligent for everyone.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Home</a></li>
                <li><a href="#features" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Features</a></li>
                <li><Link href="/login" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Login</Link></li>
                <li><Link href="/signup" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Sign Up</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Blog</a></li>
                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Market News</a></li>
                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Learning Center</a></li>
                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">API Documentation</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Support</a></li>
                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Sales</a></li>
                <li><a href="#" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">Partnerships</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 text-center">&copy; {new Date().getFullYear()} StockAnalyzer. All rights reserved.</p>
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
