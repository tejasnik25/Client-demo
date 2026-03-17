// app/strategies/page.tsx
'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import Tabs, { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FiGrid, FiList } from 'react-icons/fi';
import { FaFolder } from 'react-icons/fa';
import UserLayout from '@/components/UserLayout';
import { FiInfo, FiPlay, FiX } from 'react-icons/fi';
import { Strategy } from "@/types/strategy";
import { useAuth } from '@/hooks/use-auth';
import Badge from '@/components/ui/Badge';
import { useSearchParams } from 'next/navigation';
import { Inter } from 'next/font/google';

const octaInter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-octa',
});

const StrategiesPageInner: React.FC = () => {
  const { data: session } = useSession();
  const { user } = useAuth();
  const router = useRouter();
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  // Separate state so Info dialog does NOT auto-open on deploy
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'Premium' | 'Expert' | 'Pro' | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const searchParams = useSearchParams();
  const [topTab, setTopTab] = useState<'explore' | 'deployed'>('explore');
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<any[]>([]);
  const [loadingRunning, setLoadingRunning] = useState(true);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'tiles' | 'list'>('tiles');
  const [searchNick, setSearchNick] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  const formatCurrency = (val: number | undefined) => {
    if (val === undefined || val === null) return "$0.00";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(val);
  };

  useEffect(() => {
    const view = searchParams.get('view') === 'deployed' ? 'deployed' : 'explore';
    setTopTab(view);
  }, [searchParams]);

  useEffect(() => {
    if (!user && topTab === 'deployed') {
      setTopTab('explore');
    }
  }, [user, topTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchNick, sortBy]);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/strategies', { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const enabled = (data.strategies || []).filter((s: Strategy) => s.enabled !== false);
        setStrategies(enabled);
      } catch {
        setStrategies([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStrategies();
  }, []);

  // Fetch ads
  useEffect(() => {
    const fetchAds = async () => {
      try {
        const res = await fetch('/api/ads');
        if (res.ok) {
          const data = await res.json();
          setAds(data);
        }
      } catch (error) {
        console.error('Error fetching ads:', error);
      }
    };
    fetchAds();
  }, []);

  // Fetch running strategies for deployed view
  useEffect(() => {
    const fetchRunning = async () => {
      try {
        setLoadingRunning(true);
        const res = await fetch('/api/strategies/running', { cache: 'no-store' });
        const data = await res.json();
        setRunning(data?.strategies || []);
      } catch {
        setRunning([]);
      } finally {
        setLoadingRunning(false);
      }
    };
    fetchRunning();
  }, []);

  const stratById = useMemo(() => {
    const map = new Map<string, Strategy>();
    strategies.forEach(s => map.set(s.id, s as any));
    return map;
  }, [strategies]);

  const deployed = useMemo(() => {
    if (!user) return [] as any[];
    return running;
  }, [running, user]);

  // Determine which strategies are currently being copied by this user
  const copyingIds = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    for (const r of running as any[]) {
      const st = String((r as any)?.adminStatus || (r as any)?.status || '').toLowerCase();
      if (st === 'running' || st === 'connected' || st === 'active') {
        const sid = (r as any)?.id; // strategy id in running payload
        if (sid) set.add(String(sid));
      }
    }
    return set;
  }, [running]);

 

  const renderAdminStatusBadge = (s: string, r?: any) => {
    const k = (s || '').toLowerCase();
    const content = (() => {
      if (k === 'running') return <Badge variant="success">Running</Badge>;
      if (k === 'in-process') return <Badge variant="warning">In-Process</Badge>;
      if (k === 'disconnected' || k === 'stopped') return <Badge variant="destructive">Disconnected</Badge>;
      if (k === 'wrong-account-password') return <Badge variant="destructive">Wrong-Account Password</Badge>;
      if (k === 'wrong-account-id') return <Badge variant="destructive">Wrong-Account Id</Badge>;
      if (k === 'wrong-account-server-name') return <Badge variant="destructive">Wrong-Account Server Name</Badge>;
      if (k === 'service error' || k === 'connection failed') return <Badge variant="destructive">{s}</Badge>;
      return <Badge variant="outline">{s || 'in-process'}</Badge>;
    })();

    return (
      <div className="flex items-center gap-2">
        {content}
        
      </div>
    );
  };

  const toggleDisconnect = async (r: any) => {
    const rsId = (r as any)?.rsId || r?.id;
    const cur = ((r as any)?.adminStatus || (r as any)?.status || '').toLowerCase();
    const action = cur === 'disconnected' ? 'connect' : 'disconnect';
    if (!confirm(`Are you sure you want to ${action} this strategy?`)) return;
    // optimistic disable for this card
    setPendingIds((prev) => [...prev, rsId]);
    try {
      const res = await fetch(`/api/running-strategies/${rsId}/modification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Failed to request change');
      // Optimistically set local running item to in-process
      setRunning((prev: any[]) => prev.map(p => {
        if (((p as any).id || (p as any).rsId) === rsId) {
          return { ...p, adminStatus: 'in-process' };
        }
        return p;
      }));
    } catch (e) {
      console.error(e);
    } finally {
      // re-fetch to ensure server state is consistent
      try {
        const runRes = await fetch('/api/strategies/running', { cache: 'no-store' });
        const runData = await runRes.json();
        setRunning(runData?.strategies || []);
      } catch (e) {
      }
      setPendingIds((prev) => prev.filter(id => id !== rsId));
    }
  };

  const requestEnable = async (r: any) => {
    const rsId = (r as any)?.rsId || r?.id;
    const cur = ((r as any)?.adminStatus || (r as any)?.status || '').toLowerCase();
    if (cur !== 'disconnected' && cur !== 'stopped') return;
    if (!confirm('Connect this strategy again?')) return;
    setPendingIds((prev) => [...prev, rsId]);
    try {
      const res = await fetch(`/api/running-strategies/${rsId}/modification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable' }),
      });
      if (!res.ok) throw new Error('Failed to request enable');
      setRunning((prev: any[]) => prev.map(p => {
        if (((p as any).id || (p as any).rsId) === rsId) {
          return { ...p, adminStatus: 'in-process' };
        }
        return p;
      }));
    } catch (e) {
      console.error(e);
    } finally {
      try {
        const runRes = await fetch('/api/strategies/running', { cache: 'no-store' });
        const runData = await runRes.json();
        setRunning(runData?.strategies || []);
      } catch { }
      setPendingIds((prev) => prev.filter(id => id !== rsId));
    }
  };

  const handleViewInfo = (s: Strategy) => {
    router.push(`/strategies/${s.id}/info`);
  };

  const handleDeploy = (s: Strategy) => {
    if (!session || (session.user as any)?.role !== 'USER') {
      return router.push('/login?redirect=/strategies');
    }
    // Redirect directly to payment page - plan selection will be step 1
    router.push(`/payment?strategy=${s.id}`);
  };

  const getPlanPrices = (s: Strategy | null) => {
    if (!s) return { Premium: 5000, Expert: 10000, Pro: 20000 };

    // Use new planPrices field if available, otherwise fallback to parameters
    if (s.planPrices) {
      return {
        Premium: s.planPrices.Premium ?? 5000,
        Expert: s.planPrices.Expert ?? 10000,
        Pro: s.planPrices.Pro ?? 20000,
      };
    }

    // Fallback to old parameters method for backward compatibility
    const params = s.parameters || {} as Record<string, string>;
    const parseNum = (v?: string) => {
      const n = v ? parseFloat(v) : NaN;
      return isNaN(n) ? undefined : n;
    };
    const premium = parseNum(params['premium_price']);
    const expert = parseNum(params['expert_price']);
    const pro = parseNum(params['pro_price']);
    return {
      Premium: premium ?? 5000,
      Expert: expert ?? 10000,
      Pro: pro ?? 20000,
    };
  };

  // Display user-facing range labels per plan in the deploy dialog
  const getPlanDisplayRange = (plan: 'Premium' | 'Expert' | 'Pro'): string => {
    const s = selectedStrategy;
    const label = s?.planDetails?.[plan]?.priceLabel;
    if (label && label.trim().length > 0) return label;
    if (plan === 'Premium') return '$6000+';
    if (plan === 'Expert') return '$3000-$5999';
    return '$1000-$2999';
  };

  const getPlanPercent = (plan: 'Premium' | 'Expert' | 'Pro'): number => {
    const s = selectedStrategy;
    const pct = s?.planDetails?.[plan]?.percent;
    if (typeof pct === 'number' && !isNaN(pct)) return pct;
    if (plan === 'Premium') return 12;
    if (plan === 'Expert') return 15;
    return 17;
  };

  const confirmPlanAndRedirect = () => {
    if (selectedPlan && selectedStrategy) {
      // Redirect to the payment page with the selected plan and strategy
      router.push(`/payment?strategy=${selectedStrategy.id}&plan=${selectedPlan}`);
    }
  };

  

  const filtered = useMemo(() => {
    let filteredStrategies = activeTab === 'all'
      ? strategies
      : strategies.filter(s => s.category?.toLowerCase() === activeTab);

    if (searchNick.trim().length > 0) {
      const q = searchNick.toLowerCase();
      filteredStrategies = filteredStrategies.filter(s => (s.name || '').toLowerCase().includes(q));
    }

    // Apply sorting
    switch (sortBy) {
      case 'roi':
        filteredStrategies = [...filteredStrategies].sort((a, b) => (b.roi || 0) - (a.roi || 0));
        break;
      case 'profit':
        filteredStrategies = [...filteredStrategies].sort((a, b) => (b.profit || 0) - (a.profit || 0));
        break;
      case 'risk':
        filteredStrategies = [...filteredStrategies].sort((a, b) => (a.riskScore || 10) - (b.riskScore || 10));
        break;
      case 'highest_risk':
        filteredStrategies = [...filteredStrategies].sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
        break;
      case 'copiers':
        filteredStrategies = [...filteredStrategies].sort((a, b) => (b.copiers || 0) - (a.copiers || 0));
        break;
      case 'default':
      default:
        // Keep original order
        break;
    }

    return filteredStrategies;
  }, [strategies, activeTab, sortBy, searchNick]);

  const paginatedStrategies = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const paginationNumbers = useMemo<(number | string)[]>(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
      return pages;
    }
    if (currentPage <= 4) {
      for (let i = 1; i <= 5; i += 1) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
      return pages;
    }
    if (currentPage >= totalPages - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 4; i <= totalPages; i += 1) pages.push(i);
      return pages;
    }
    pages.push(1);
    pages.push('...');
    for (let i = currentPage - 1; i <= currentPage + 1; i += 1) pages.push(i);
    pages.push('...');
    pages.push(totalPages);
    return pages;
  }, [currentPage, totalPages]);

  return (
    <UserLayout>
      <div className={`min-h-screen bg-gray-50 text-gray-900 overflow-x-hidden octa-font ${octaInter.variable}`}>
        {/* Header */}

        {/* Hero Ad (same as Dashboard) */}
        <div className="px-0 md:px-6 mt-4 md:mt-8 lg:mt-10">
          <div className="bg-white rounded-[40px] border border-gray-200 shadow-md px-6 py-6 md:py-0 md:px-10 h-auto md:h-40 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-10 lg:gap-16">
            <div className="text-center md:text-left flex flex-col justify-center">
              <h2 className="text-xl md:text-2xl lg:text-3xl font-extrabold tracking-tight text-gray-900 leading-tight">
                COPY TRADING<br />STRATEGIES
              </h2>
              <p className="mt-1 md:mt-2 text-xs md:text-sm text-gray-600">
                Find the Strategy Provider that matches your<br />goals. Follow with just one click.
              </p>
            </div>
            <div className="hidden md:flex justify-center">
              <Image
                src="/Ad-1.png"
                alt="trading_hero advertisement"
                width={1200}
                height={400}
                className="h-32 md:h-52 lg:h-64 w-auto object-contain"
                priority
                quality={100}
              />
            </div>
          </div>
        </div>

        {/* Top Ads */}
        {ads.filter(ad => ad.isActive && ad.position === 'top').length > 0 && (
          <div className="px-6 space-y-4">
            {ads
              .filter(ad => ad.isActive && ad.position === 'top')
              .map(ad => (
                <div
                  key={ad.id}
                  className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col lg:flex-row items-center gap-6">
                    {ad.imageUrl && (
                      <div className="flex-shrink-0">
                        <img
                          src={ad.imageUrl}
                          alt={ad.title}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      </div>
                    )}
                    <div className="flex-1 text-center lg:text-left">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">{ad.title}</h3>
                      <p className="text-gray-600 mb-4">{ad.content}</p>
                      {ad.linkUrl && (
                        <a
                          href={ad.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-gradient-to-r from-[#0078d4] to-[#00d09c] text-white px-6 py-2 rounded-lg hover:opacity-90 transition-opacity"
                        >
                          Learn More
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Tabs + Filters */}
        <div className="px-4 md:px-6 py-5 space-y-5">
          {/* Top Tabs */}
          <div className="flex gap-3 border-b border-gray-200">
            <button
              onClick={() => setTopTab('explore')}
              className={`px-6 py-3 text-sm font-medium transition-all ${topTab === 'explore'
                ? 'text-[#00d09c] border-b-2 border-[#00d09c]'
                : 'text-gray-500 hover:text-gray-900'
                }`}
            >
              Top Masters
            </button>
            {user && (
              <button
                onClick={() => setTopTab('deployed')}
                className={`px-6 py-3 text-sm font-bold transition-all ${topTab === 'deployed'
                  ? 'text-[#00d09c] border-b-2 border-[#00d09c]'
                  : 'text-gray-500 hover:text-gray-900'
                  }`}
              >
                Copier
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex gap-2">
            {['Premium', 'Expert', 'Pro'].map((chip) => (
              <button key={chip} className="px-4 py-1.5 rounded-full text-[11px] bg-white border border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-all">
                {chip}
              </button>
            ))}
          </div>

          {/* Sort By */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">Sort by:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-48 bg-white border-gray-200 rounded-xl h-10">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="roi">Highest ROI</SelectItem>
                  <SelectItem value="profit">Highest Profit</SelectItem>
                  <SelectItem value="risk">Lowest Risk</SelectItem>
                  <SelectItem value="highest_risk">Highest Risk</SelectItem>
                  <SelectItem value="copiers">Most Copiers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center">
              <input
                value={searchNick}
                onChange={(e) => setSearchNick(e.target.value)}
                placeholder="Nickname"
                className="w-full md:w-64 px-4 py-2 rounded-xl border border-gray-200 bg-white h-10 text-sm focus:border-[#00d09c] outline-none"
              />
            </div>

            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-100 shadow-sm md:ml-auto">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'text-[#0078d4] bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
                title="List view"
              >
                <FiList className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('tiles')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'tiles' ? 'text-[#0078d4] bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
                title="Tiles view"
              >
                <FiGrid className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Strategy Cards - Full Width */}
        <div className="px-4 md:px-6 pb-10 space-y-4">
          {topTab === 'deployed' ? (
            loadingRunning ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-gray-400 text-sm font-medium">Loading your portfolio...</p>
              </div>
            ) : deployed.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FaFolder className="w-8 h-8 text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">No active copies found</h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto mb-6">You aren't currently copying any master accounts. Explore Top Masters to start!</p>
                <button 
                  onClick={() => setTopTab('explore')}
                  className="bg-[#00d09c] text-white px-8 py-2 rounded-xl font-bold text-sm"
                >
                  Find Masters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {deployed.map((r: any, index: number) => {
                  const s = stratById.get(r.id) || strategies.find(ss => ss.name === r.name);
                  if (!s) return null;
                  
                  const cur = ((r as any)?.adminStatus || (r as any)?.status || '').toLowerCase();
                  const isPending = pendingIds.includes((r as any)?.rsId || r.id);
                  const investedAmount = r.capital || 47.00;
                  
                  return (
                    <div key={r.rsId || `${r.id}-${index}`} className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
                        {/* Left: Info */}
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100 overflow-hidden relative">
                            <Image 
                              src={s.imageUrl || '/strategy1.svg'} 
                              alt={s.name} 
                              width={40} 
                              height={40} 
                              className="object-contain"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-white bg-blue-600 px-2 py-0.5 rounded-md uppercase tracking-tighter mb-1 inline-block">Master</span>
                            <h4 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">{s.name}</h4>
                          </div>
                        </div>

                        {/* Right: Actions & Status & Metrics */}
                        <div className="flex flex-wrap items-center gap-4 md:gap-12 ml-auto">
                          <div className="flex flex-col items-center">
                            <span className="text-[11px] font-bold text-gray-300 uppercase mb-1">Status</span>
                            {cur === 'running' || cur === 'active' ? (
                              <span className="text-white font-bold bg-[#00d09c] px-3 py-1 rounded-full text-[11px]">Running</span>
                            ) : (
                              renderAdminStatusBadge(cur, r)
                            )}
                          </div>

                          <div className="flex flex-col items-center">
                            <span className="text-[11px] font-bold text-gray-300 uppercase mb-1">Balance</span>
                            <span className="text-sm font-bold text-gray-900">{formatCurrency(investedAmount)}</span>
                          </div>

                          <div className="flex flex-col items-center">
                            <span className="text-[11px] font-bold text-gray-300 uppercase mb-1">Equity</span>
                            <span className="text-sm font-bold text-gray-900">{formatCurrency(investedAmount)}</span>
                          </div>

                          <div className="flex flex-col items-center">
                            <span className="text-[11px] font-bold text-gray-300 uppercase mb-1">Float Profit</span>
                            <span className={`text-sm font-bold ${(r.floatProfit || 0) > 0 ? 'text-green-500' : (r.floatProfit || 0) < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                              {formatCurrency(r.floatProfit || 0.00)}
                            </span>
                          </div>

                          <Link 
                            href={`/strategies/running/${s.id}/history`} 
                            className="text-gray-400 hover:text-gray-900 text-[12px] font-bold underline decoration-gray-300 underline-offset-4 transition-colors"
                          >
                            View History
                          </Link>

                          <div className="w-auto">
                            {cur === 'disconnected' || cur === 'stopped' ? (
                              <button
                                className="h-11 px-8 bg-[#00d09c] hover:bg-[#00b88a] text-white rounded-xl font-bold text-base transition-all disabled:opacity-50"
                                onClick={() => requestEnable(r)}
                                disabled={isPending}
                              >
                                {isPending ? 'Processing...' : 'Connect'}
                              </button>
                            ) : (
                              <button
                                className="h-11 px-8 bg-[#00d09c] hover:bg-[#00b88a] text-white rounded-xl font-bold text-base transition-all disabled:opacity-50"
                                onClick={() => toggleDisconnect(r)}
                                disabled={isPending || cur === 'in-process'}
                              >
                                {isPending || cur === 'in-process' ? 'Processing...' : 'Disconnect'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Error Message Section */}
                      {(r as any).rejectionReason && (
                        <div className="mt-4 p-3 bg-red-50 text-red-600 text-[11px] rounded-lg border border-red-100 flex items-start gap-2">
                           <FiInfo className="flex-shrink-0 mt-0.5" />
                           <div>
                             <strong>Error:</strong> {(r as any).rejectionReason}
                           </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-white rounded-2xl p-6 space-y-3 border border-gray-200">
                <div className="h-6 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500 bg-white rounded-2xl border border-gray-200">
              No strategies found.
            </div>
          ) : (
            viewMode === 'tiles'
              ? (
                <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedStrategies.map(strategy => {
                    const profit = strategy.profit || 0;
                    const copiers = strategy.copiers || 0;
                    const roi = strategy.roi || 0;

                    const isCopying = copyingIds.has(strategy.id);
                    return (
                      <div
                        key={strategy.id}
                        className={`w-full bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all cursor-pointer ${isCopying ? 'border-white' : 'border-gray-200'} relative`}
                        onClick={() => handleViewInfo(strategy)}
                      >
                        {isCopying && (
                          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-semibold tracking-wide">
                            Copying
                          </div>
                        )}
                        {/* Header Section */}
                        <div className="p-5 pb-4">
                          <div className="flex items-start justify-between mb-2">
                            {/* Left: Icon + Name */}
                            <div className="flex items-center gap-3">
                              <div className="relative w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                {strategy.imageUrl ? (
                                  <img
                                    src={strategy.imageUrl}
                                    alt={strategy.name}
                                    className="w-10 h-10 object-contain rounded-full"
                                  />
                                ) : (
                                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                )}
                                {(() => {
                                  const cc = String(strategy.parameters?.countryFlag || '').toLowerCase();
                                  const isCC = /^[a-z]{2}$/.test(cc);
                                  const url = isCC ? `https://flagcdn.com/24x18/${cc}.png` : '';
                                  return url ? (
                                    <img
                                      src={url}
                                      alt={cc}
                                      className="absolute -left-1 bottom-0 translate-y-1 w-5 h-4 rounded-sm border border-white shadow-sm"
                                    />
                                  ) : null;
                                })()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">

                                  <h3 className="text-base font-semibold text-gray-900">{strategy.name}</h3>
                                </div>
                                {strategy.mastersTag && (
                                  <p className="text-xs text-blue-600 mt-0.5">{strategy.mastersTag}</p>
                                )}

                              </div>

                            </div>
                            <span className={`px-3 py-2 rounded-full text-white text-xs ${typeof strategy.riskScore === 'number'
                                ? (strategy.riskScore <= 2 ? 'bg-[#22c55e]' : strategy.riskScore <= 4 ? 'bg-[#f97316]' : 'bg-[#ef4444]')
                                : 'bg-[#22c55e]'
                              }`}>
                              {typeof strategy.riskScore === 'number' ? `${strategy.riskScore} risk` : '1 risk'}
                            </span>
                          </div>
                          <div className="border-b border-gray-200 mt-2" />

                          {/* Stats Row - 3 Columns */}
                          <div className="grid grid-cols-3 justigy-space-between gap-4 mb-5 mt-5">
                            {/* ROI */}
                            <div className="text-center">
                              <div className="text-s text-gray-600 mb-1.5">ROI</div>
                              <div className="text-lg font-bold text-green-600">
                                {roi > 0 ? `+${roi}%` : '+0%'}
                              </div>
                            </div>

                            {/* Drawdown */}
                            <div className="text-center">
                              <div className="text-s text-gray-600 mb-1.5">Drawdown</div>
                              <div className="text-lg font-bold text-gray-900">
                                {typeof strategy.maxDdi === 'number' ? `${strategy.maxDdi}%` : '0%'}
                              </div>
                            </div>

                            {/* Copiers */}
                            <div className="text-center">
                              <div className="text-s text-gray-600 mb-1.5">Copiers</div>
                              <div className="text-lg font-bold text-gray-900">
                                {copiers}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 mb-1">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-s text-gray-600">Profit & Loss</span>
                              <span className={`text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(() => {
                                  const sym = String(strategy.parameters?.currencySymbol || strategy.parameters?.currency || '').trim();
                                  return `${profit >= 0 ? '+' : '-'}${sym}${Math.abs(profit).toLocaleString()}`;
                                })()}
                              </span>
                            </div>
                            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden flex">
                              {(() => {
                                const rawDrawdown =
                                  typeof strategy.maxDdi === 'number' ? strategy.maxDdi : 0;
                                const drawdownValue = Math.min(Math.abs(rawDrawdown), 100);
                                const isNegative = rawDrawdown < 0;
                                const redWidth = isNegative ? 100 - drawdownValue : drawdownValue;
                                const greenWidth = 100 - redWidth;

                                return (
                                  <>
                                    {greenWidth > 0 && (
                                      <div
                                        className="h-full bg-green-600"
                                        style={{ width: `${greenWidth}%` }}
                                      />
                                    )}
                                    {redWidth > 0 && (
                                      <div
                                        className="h-full bg-red-500"
                                        style={{ width: `${redWidth}%` }}
                                      />
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Copy Button */}
                        <div className="px-5 pb-5">
                          <button
                            className="w-full h-11 bg-green-600 hover:bg-green-600 text-white font-medium rounded-xl transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleDeploy(strategy); }}
                          >
                            Set Up Copy
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
              : (
                <div className="space-y-3">
                  {filtered.map(strategy => {
                    const isCopyingList = copyingIds.has(strategy.id);
                    return (
                    <div
                      key={strategy.id}
                      className={`group bg-white rounded-xl p-4 border hover:shadow-sm transition-all cursor-pointer ${isCopyingList ? 'border-white' : 'border-gray-200'} relative`}
                      onClick={() => handleViewInfo(strategy)}
                    >
                      {isCopyingList && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-semibold tracking-wide">
                          Copying
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <div className="relative w-11 h-11 flex-shrink-0">
                          <div className="w-full h-full rounded-full border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                            {strategy.imageUrl ? (
                              <img src={strategy.imageUrl} alt={strategy.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-[#7c3aed] to-[#a855f7] flex items-center justify-center">
                                <span className="text-white font-bold text-sm">
                                  {strategy.name?.charAt(0)?.toUpperCase() || 'S'}
                                </span>
                              </div>
                            )}
                          </div>
                          {(() => {
                            const cc = String(strategy.parameters?.countryFlag || '').toLowerCase();
                            const isCC = /^[a-z]{2}$/.test(cc);
                            const url = isCC ? `https://flagcdn.com/24x18/${cc}.png` : '';
                            return url ? (
                              <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-white border-2 border-white shadow-md flex items-center justify-center overflow-hidden">
                                <img
                                  src={url}
                                  alt={cc}
                                  className="w-4 h-3 object-cover"
                                />
                              </div>
                            ) : null;
                          })()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-semibold truncate">{strategy.name}</h4>
                            {strategy.mastersTag && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex-shrink-0">
                                {strategy.mastersTag}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="hidden md:flex flex-1 justify-center octa-font">
                          <div className="grid grid-cols-4 gap-8 text-center">
                            <div className="flex flex-col items-center">
                              <div className="text-[13px] octa-muted">Risk Score</div>
                              <div className={`px-2 py-0.5 text-[12px] rounded-full text-white font-semibold ${typeof strategy.riskScore === 'number'
                                  ? (strategy.riskScore <= 2 ? 'bg-[#22c55e]' : strategy.riskScore <= 4 ? 'bg-[#f97316]' : 'bg-[#ef4444]')
                                  : 'bg-[#22c55e]'
                                }`}>
                                {typeof strategy.riskScore === 'number' ? `${strategy.riskScore} risk` : '-'}
                              </div>
                            </div>
                            <div className="flex flex-col items-center">
                              <div className="text-[13px] octa-muted">ROI</div>
                              <div className="text-[16px] font-semibold text-green-600">
                                {typeof strategy.roi === 'number' ? `${strategy.roi}%` : '-'}
                              </div>
                            </div>
                            <div className="flex flex-col items-center">
                              <div className="text-[13px] octa-muted">Drawdown</div>
                              <div className="text-[16px] font-semibold octa-text">
                                {typeof strategy.maxDdi === 'number' ? `${strategy.maxDdi}%` : '-'}
                              </div>
                            </div>
                            <div className="flex flex-col items-center">
                              <div className="text-[13px] octa-muted">Copiers</div>
                              <div className="text-[16px] font-semibold octa-text">
                                {typeof strategy.copiers === 'number' ? strategy.copiers : '-'}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="ml-auto">
                          <Button
                            size="sm"
                            className="h-10 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleDeploy(strategy); }}
                          >
                            Set Up Copy
                          </Button>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              )
          )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12 pb-10">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-900 disabled:opacity-50 transition-all text-sm font-medium"
              >
                Previous
              </button>
              {paginationNumbers.map((item, index) =>
                typeof item === 'number' ? (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    className={`w-8 h-8 rounded-lg font-bold text-sm transition-all ${currentPage === item
                        ? 'bg-red-600 text-white shadow-md'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    {item}
                  </button>
                ) : (
                  <span
                    key={index}
                    className="px-2 h-8 flex items-center justify-center text-xs md:text-sm text-gray-500"
                  >
                    {item}
                  </span>
                ),
              )}
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-gray-900 disabled:opacity-50 transition-all text-sm font-medium"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Ads Section */}
        {ads.filter(ad => ad.isActive && ad.position === 'bottom').length > 0 && (
          <div className="px-6 pb-10">
            <div className="space-y-4">
              {ads
                .filter(ad => ad.isActive && ad.position === 'bottom')
                .map(ad => (
                  <div
                    key={ad.id}
                    className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-md transition-all"
                  >
                    <div className="flex flex-col lg:flex-row items-center gap-6">
                      {ad.imageUrl && (
                        <div className="flex-shrink-0">
                          <img
                            src={ad.imageUrl}
                            alt={ad.title}
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                        </div>
                      )}
                      <div className="flex-1 text-center lg:text-left">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{ad.title}</h3>
                        <p className="text-gray-600 mb-4">{ad.content}</p>
                        {ad.linkUrl && (
                          <a
                            href={ad.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block bg-gradient-to-r from-[#0078d4] to-[#00d09c] text-white px-6 py-2 rounded-lg hover:opacity-90 transition-opacity"
                          >
                            Learn More
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Info Dialog (kept, but controlled independently so deploy won't open it) */}
        <Dialog open={infoDialogOpen} onOpenChange={(o) => setInfoDialogOpen(o)}>
          <DialogContent className="max-w-4xl bg-[#161d31] text-white border-[#283046]">
            {selectedStrategy && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl">{selectedStrategy.name}</DialogTitle>
                  <DialogDescription className="text-gray-400">{selectedStrategy.description}</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-6">
                  {/* FusionX-style info content container */}
                  <div className="rounded-xl border border-white/10 bg-[#0f172a] p-3">
                    {selectedStrategy.contentUrl ? (
                      selectedStrategy.contentType === 'pdf' ? (
                        <object
                          data={selectedStrategy.contentUrl}
                          type="application/pdf"
                          className="w-full h-[70vh]"
                        >
                          <iframe
                            src={selectedStrategy.contentUrl}
                            className="w-full h-full"
                          />
                        </object>
                      ) : (
                        <iframe
                          src={selectedStrategy.contentUrl}
                          className="w-full h-[70vh] rounded-lg"
                        />
                      )
                    ) : (
                      <div className="h-48 bg-gradient-to-br from-[#7c3aed]/20 to-transparent rounded-xl flex items-center justify-center">
                        <div className="text-sm text-gray-400">No info document available</div>
                      </div>
                    )}
                  </div>

                  {/* Optional details below the embedded content */}
                  {selectedStrategy.details && (
                    <p className="text-sm text-gray-300">{selectedStrategy.details}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button className="bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] transition-opacity" onClick={() => handleDeploy(selectedStrategy)}>
                    <FiPlay className="mr-2 fx-3d-icon" /> Copy Strategy
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Plan Selection Dialog - Full Overlay */}
        <Dialog open={planDialogOpen} onOpenChange={(o) => setPlanDialogOpen(o)}>
          <DialogContent className="max-w-md bg-gray-900 text-white border-gray-700 shadow-2xl">
            {/* Custom Overlay with 100% opacity */}
            <div className="fixed inset-0 z-40 bg-black" />

            <div className="relative z-50">
              <DialogHeader>
                <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                  <DialogTitle className="text-xl font-bold text-white">Select a Plan</DialogTitle>
                  <button
                    onClick={() => setPlanDialogOpen(false)}
                    className="text-gray-400 hover:text-white text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>
                <DialogDescription className="mt-4 text-gray-400">
                  Choose Premium, Expert, or Pro to continue.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-4">
                {(['Premium', 'Expert', 'Pro'] as const).map((plan) => {
                  const rangeLabel = getPlanDisplayRange(plan);
                  const active = selectedPlan === plan;
                  const descriptions = {
                    Premium: 'Basic access with standard features.',
                    Expert: 'Advanced features with priority support.',
                    Pro: 'Full access with premium analytics.'
                  };

                  return (
                    <div
                      key={plan}
                      onClick={() => setSelectedPlan(plan)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${active
                        ? 'border-purple-500 bg-purple-900/20'
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                        }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white text-lg">{plan}</h3>
                          <p className="text-sm text-gray-400 mt-1">{descriptions[plan]}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-teal-400">{rangeLabel}</p>
                          <p className="text-xs text-gray-400 mt-1">{getPlanPercent(plan)}% of your capital for 1 year</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <DialogFooter className="mt-6">
                <button
                  disabled={!selectedPlan}
                  onClick={confirmPlanAndRedirect}
                  className={`w-full py-3 rounded-xl font-semibold transition-all ${selectedPlan
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  Continue to Payment
                </button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
        

        {/* Become a Strategy Provider Ad (same as Dashboard) */}
        <div className="my-10 md:my-16 lg:my-28 px-4 md:px-6">
          <div className="mx-auto max-w-6xl flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 leading-tight">
                BECOME A
                <br />
                <span className="text-red-600">STRATEGY PROVIDER</span>
              </h2>
              <p className="mt-4 text-sm md:text-base text-gray-700">
                Showcase your trading skills to other traders in the community, build an inventory of followers and get
                rewarded for your successful performance. Lead the way and amplify your gains.
              </p>
              <div className="mt-6">
                <button className="inline-flex items-center justify-center px-6 py-3 rounded-xl border-2 border-red-600 bg-transparent text-black text-xs md:text-sm font-semibold tracking-wide shadow-sm hover:bg-red-600 hover:text-white transition-colors duration-300">
                  BECOME A STRATEGY PROVIDER
                </button>
                <p className="mt-2 text-[10px] text-gray-500">Terms and Conditions apply</p>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end w-full lg:w-auto">
              <Image
                src="/Ad-2.png"
                alt="Become a strategy provider"
                width={1200}
                height={600}
                className="w-full max-w-xl md:max-w-2xl h-auto object-contain"
                quality={100}
              />
            </div>
          </div>
        </div>

        
      </div>
    </UserLayout>
  );
};

const StrategiesPage = () => (
  <Suspense fallback={<div className="min-h-screen bg-[#0f1527] text-white p-6">Loading...</div>}>
    <StrategiesPageInner />
  </Suspense>
);
export default StrategiesPage;


