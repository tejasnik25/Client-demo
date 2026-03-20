'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import Image from 'next/image';
import UserLayout from '@/components/UserLayout';
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { FiPlus, FiArrowUpRight, FiDollarSign, FiClock, FiCheckCircle, FiXCircle } from 'react-icons/fi';

const WalletPageContent: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [balanceRes, txRes] = await Promise.all([
          fetch('/api/profile', { cache: 'no-store' }),
          fetch('/api/wallet/transactions', { cache: 'no-store' })
        ]);
        
        const balanceData = await balanceRes.json();
        if (balanceData?.success) {
          setWalletBalance(balanceData.user?.wallet_balance || 0);
        }

        const txData = await txRes.json();
        if (txData?.success) {
          setTransactions(txData.transactions || []);
        }
      } catch (error) {
        console.error('Failed to fetch wallet data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return <FiCheckCircle className="text-green-500" />;
      case 'failed': return <FiXCircle className="text-red-500" />;
      default: return <FiClock className="text-amber-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Wallet Balance Card */}
      <div className="bg-gradient-to-br from-gray-900 to-black rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] -mr-32 -mt-32 rounded-full" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 blur-[100px] -ml-32 -mb-32 rounded-full" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <p className="text-gray-400 font-medium uppercase tracking-widest text-xs mb-2">Total Balance</p>
            <h2 className="text-5xl font-black flex items-center gap-2">
              <span className="text-blue-500">$</span>
              {walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => router.push('/wallet/topup')}
              className="flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
              <FiPlus className="w-5 h-5" />
              Deposit
            </button>
            <button 
              className="flex items-center gap-2 px-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold transition-all border border-white/10 active:scale-95"
              onClick={() => router.push('/wallet/withdraw')}
            >
              <FiArrowUpRight className="w-5 h-5" />
              Withdrawal
            </button>
          </div>
        </div>
      </div>

      {/* Quick Deposit Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button 
          onClick={() => router.push('/wallet/topup?method=USDT_TRC20')}
          className="flex flex-col items-center gap-4 p-6 bg-white border border-gray-100 rounded-3xl hover:shadow-xl transition-all group"
        >
          <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Image src="/usdt_trc20-qr.svg" alt="Tether" width={24} height={24} className="opacity-80" />
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-900">Tether (TRC20)</p>
            <p className="text-xs text-gray-500">Instant Deposit</p>
          </div>
        </button>

        <button 
          onClick={() => router.push('/wallet/topup?method=USDT_ERC20')}
          className="flex flex-col items-center gap-4 p-6 bg-white border border-gray-100 rounded-3xl hover:shadow-xl transition-all group"
        >
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Image src="/usdt_erc20-qr.svg" alt="Tether" width={24} height={24} className="opacity-80" />
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-900">Tether (ERC20)</p>
            <p className="text-xs text-gray-500">Secure Payment</p>
          </div>
        </button>

        <button 
          onClick={() => router.push('/wallet/topup?method=QR')}
          className="flex flex-col items-center gap-4 p-6 bg-white border border-gray-100 rounded-3xl hover:shadow-xl transition-all group"
        >
          <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Image src="/upi-qr.svg" alt="UPI" width={24} height={24} className="opacity-80" />
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-900">UPI / QR Code</p>
            <p className="text-xs text-gray-500">Local Payment</p>
          </div>
        </button>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900">Transaction History</h3>
          <button className="text-sm font-bold text-blue-600 hover:text-blue-700">View All</button>
        </div>
        
        <div className="divide-y divide-gray-50">
          {transactions.length > 0 ? transactions.slice(0, 5).map((tx) => (
            <div key={tx.id} className="px-8 py-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  tx.transaction_type === 'deposit' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  {tx.transaction_type === 'deposit' ? <FiPlus /> : <FiDollarSign />}
                </div>
                <div>
                  <p className="font-bold text-gray-900 capitalize">{tx.payment_method?.replace('_', ' ') || tx.transaction_type}</p>
                  <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleString()}</p>
                </div>
              </div>
              
              <div className="text-right">
                <p className={`font-black ${tx.transaction_type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.transaction_type === 'deposit' ? '+' : '-'}${tx.amount.toFixed(2)}
                </p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  {getStatusIcon(tx.status)}
                  <span className="text-[10px] font-bold uppercase tracking-tight text-gray-400">{tx.status}</span>
                </div>
                {String(tx.status || '').toLowerCase() === 'failed' && tx.rejection_reason && (
                  <p className="mt-1 text-[11px] text-red-300 max-w-[240px] break-words">
                    {tx.rejection_reason}
                  </p>
                )}
              </div>
            </div>
          )) : (
            <div className="p-12 text-center text-gray-500">
              <FiClock className="mx-auto mb-2 h-8 w-8 opacity-20" />
              <p className="font-medium">No transactions found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main page with UserLayout wrapper
const WalletPageInner: React.FC = () => {
  return (
    <UserLayout>
      <div className="p-6">
        <WalletPageContent />
      </div>
    </UserLayout>
  );
};

const WalletPage: React.FC = () => {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading wallet...</div>}>
      <WalletPageInner />
    </Suspense>
  );
};

export default WalletPage;
