"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import UserLayout from "@/components/UserLayout";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { 
  FiSearch, 
  FiFilter, 
  FiGrid, 
  FiList, 
  FiChevronLeft, 
  FiChevronRight, 
  FiActivity,
  FiMenu,
  FiRefreshCw,
  FiChevronDown
} from "react-icons/fi";
import { FaWallet } from "react-icons/fa";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import Input from "@/components/ui/Input";

type RunningItem = { 
  id: string; 
  name: string; 
  status?: string; 
  adminStatus?: string;
  balance?: number;
  equity?: number;
  floatProfit?: number;
  capital?: number;
};

type Strategy = {
  id: string;
  name: string;
  description: string;
  performance: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  category: 'Growth' | 'Income' | 'Momentum' | 'Value';
  imageUrl: string;
  tag?: string;
  mastersTag?: string;
};

const RunningStrategiesPageInner: React.FC = () => {
  const router = useRouter();
  const [running, setRunning] = useState<RunningItem[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [user, setUser] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [showStats, setShowStats] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 5;

  const loadData = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const [runRes, stratRes, profileRes] = await Promise.all([
        fetch('/api/strategies/running', { cache: 'no-store' }),
        fetch('/api/strategies', { cache: 'no-store' }),
        fetch('/api/profile', { cache: 'no-store' })
      ]);
      
      const runData = await runRes.json();
      const stratData = await stratRes.json();
      const profileData = await profileRes.json();

      setRunning(runData?.strategies || []);
      setStrategies((stratData?.strategies || []).filter((s: any) => s.enabled !== false));
      if (profileData.success) {
        setUser(profileData.user);
        setProfileLoading(false);
      }

      // Initialize expanded IDs if not already done
      if (expandedIds.size === 0 && runData?.strategies?.length > 0) {
        setExpandedIds(new Set(runData.strategies.map((r: any) => r.id)));
      }
    } catch (err) {
      console.error("Failed to load copier data:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    
    // Auto-refresh disabled per user request
    // const interval = setInterval(() => {
    //   loadData(false);
    // }, 10000);

    // return () => clearInterval(interval);
  }, []);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const stratById = useMemo(() => {
    const map = new Map<string, Strategy>();
    strategies.forEach(s => map.set(s.id, s));
    return map;
  }, [strategies]);

  const filteredRunning = useMemo(() => {
    let result = running.filter(r => {
      const s = stratById.get(r.id);
      if (!s) return false;
      return s.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (sortBy === "name") {
      result.sort((a, b) => (stratById.get(a.id)?.name || "").localeCompare(stratById.get(b.id)?.name || ""));
    } else if (sortBy === "profit") {
      result.sort((a, b) => (b.floatProfit || 0) - (a.floatProfit || 0));
    }

    return result;
  }, [running, searchTerm, sortBy, stratById]);

  const totalPages = Math.ceil(filteredRunning.length / itemsPerPage);
  const paginatedRunning = filteredRunning.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatCurrency = (val: number | undefined) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(val || 0);
  };

  const renderStatus = (status: string | undefined) => {
    const s = (status || 'in-process').toLowerCase();
    if (s === 'running' || s === 'active') return <span className="text-white font-bold bg-[#00d09c] px-3 py-1 rounded-full text-[10px]">Copying</span>;
    if (s === 'paused') return <span className="text-yellow-600 font-bold bg-yellow-100 px-3 py-1 rounded-full text-[10px]">Paused</span>;
    return <span className="text-gray-500 font-bold bg-gray-100 px-3 py-1 rounded-full text-[10px] uppercase">{s}</span>;
  };

  return (
    <UserLayout>
      {/* Mobile View - Matches "Your investments" image */}
      <div className="min-h-screen bg-[#f1f4f9] md:hidden">
        {/* Mobile Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-white">
          <div className="flex items-center gap-6">
            <FiMenu className="w-7 h-7 text-[#002b5c]" />
            <h1 className="text-2xl font-bold text-[#002b5c]">Your investments</h1>
          </div>
          <button onClick={() => window.location.reload()} className="p-2">
            <FiRefreshCw className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Your Stats Section */}
        <div className="px-4 py-6">
          <button 
            onClick={() => setShowStats(!showStats)}
            className="flex items-center justify-between w-full mb-6 px-2"
          >
            <span className="text-xl font-bold text-[#002b5c]">Your stats</span>
            <FiChevronDown className={`w-6 h-6 text-gray-900 transition-transform ${showStats ? '' : '-rotate-90'}`} />
          </button>
          
          {showStats && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 mb-8">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[11px] text-gray-400 mb-1 uppercase font-bold tracking-wider">Total Balance</p>
                  <p className="text-2xl font-black text-[#002b5c]">
                    {formatCurrency(running.reduce((acc, curr) => acc + ((curr as any).capital || 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-1 uppercase font-bold tracking-wider">Total Profit</p>
                  <p className="text-2xl font-black text-green-500">
                    {formatCurrency(running.reduce((acc, curr) => acc + (curr.floatProfit || 0), 0))}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Investment Cards */}
          <div className="space-y-6 pb-20">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-10 h-10 border-4 border-[#00d09c]/20 border-t-[#00d09c] rounded-full animate-spin" />
              </div>
            ) : filteredRunning.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-gray-200">
                <p className="text-gray-400">No active investments</p>
              </div>
            ) : (
              paginatedRunning.map(r => {
                const s = stratById.get(r.id);
                if (!s) return null;
                const investedAmount = (r as any).capital || 47.00;
                
                const isExpanded = expandedIds.has(r.id);
                
                return (
                  <div key={r.id} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 relative overflow-hidden">
                    <div className="p-8">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-full overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center">
                            {s.imageUrl ? (
                              <Image 
                                src={s.imageUrl} 
                                alt={s.name} 
                                width={56} 
                                height={56} 
                                className="object-contain"
                              />
                            ) : (
                              <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-500 font-bold">
                                {s.name?.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-white bg-blue-600 px-2 py-0.5 rounded-md uppercase tracking-tighter mb-1 inline-block">Master</span>
                            <h3 className="text-base font-bold text-[#002b5c] leading-tight">{s.name}</h3>
                          </div>
                        </div>
                        <button 
                          onClick={() => toggleExpand(r.id)}
                          className="p-2 -mr-2"
                        >
                          <FiChevronDown className={`w-7 h-7 text-gray-900 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-8 pt-6 border-t border-gray-100 mt-4">
                          <div className="flex flex-col items-center">
                            <p className="text-[11px] font-bold text-gray-300 uppercase mb-2">Status</p>
                            <span className="text-white font-bold bg-[#00d09c] px-4 py-1.5 rounded-full text-[11px]">Copying</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <p className="text-[11px] font-bold text-gray-300 uppercase mb-2">Balance</p>
                            <p className="text-lg font-bold text-gray-900">{formatCurrency(investedAmount)}</p>
                          </div>
                          <div className="flex flex-col items-center">
                            <p className="text-[11px] font-bold text-gray-300 uppercase mb-2">Equity</p>
                            <p className="text-lg font-bold text-gray-900">{formatCurrency(investedAmount)}</p>
                          </div>
                          <div className="flex flex-col items-center">
                            <p className="text-[11px] font-bold text-gray-300 uppercase mb-2">Float profit</p>
                            <p className={`text-lg font-bold ${(r.floatProfit || 0) > 0 ? 'text-green-500' : (r.floatProfit || 0) < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                              {formatCurrency(r.floatProfit || 0.00)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Desktop View - Existing professional design */}
      <div className="hidden md:block min-h-screen bg-[#f8f9fa] text-gray-900 px-4 py-6 md:px-8">
        {/* Top Header Tabs & Wallet */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center">
            <Link href="/strategies" className="px-6 py-3 text-sm font-medium text-gray-500 hover:text-gray-900">
              Top Masters
            </Link>
            <div className="px-6 py-3 text-sm font-bold text-[#00d09c] border-b-2 border-[#00d09c]">
              Copier
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Wallet Balance</p>
              <p className="text-lg font-bold text-gray-900">
                {profileLoading && user?.wallet_balance === undefined ? (
                  <span className="animate-pulse opacity-50">...</span>
                ) : (
                  formatCurrency(user?.wallet_balance)
                )}
              </p>
            </div>
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200 shadow-sm">
              <FaWallet className="text-gray-600 w-5 h-5" />
            </div>
            <Button 
              onClick={() => router.push('/wallet')}
              className="bg-[#00d09c] hover:bg-[#00b88a] text-white font-bold px-6 py-2 rounded-full transition-all text-sm"
            >
              Deposit
            </Button>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Sort by:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] bg-white border-gray-200 rounded-xl h-10">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="name">Nickname</SelectItem>
                  <SelectItem value="profit">Float Profit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative w-full md:w-64">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input 
                placeholder="Nickname" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white border-gray-200 rounded-xl h-10 w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-50 text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <FiList className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-blue-50 text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <FiGrid className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Strategies List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-gray-400 text-sm font-medium">Loading your portfolio...</p>
          </div>
        ) : filteredRunning.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FiActivity className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No active copies found</h3>
            <p className="text-gray-500 text-sm max-w-xs mx-auto mb-6">You aren't currently copying any master accounts. Explore Top Masters to start!</p>
            <Link href="/strategies">
              <Button className="bg-[#00d09c] text-white px-8 rounded-xl font-bold">Find Masters</Button>
            </Link>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {paginatedRunning.map(r => {
              const s = stratById.get(r.id);
              if (!s) return null;
              
              const investedAmount = Number(r.capital) || 0;

              if (viewMode === 'list') {
                return (
                  <div key={r.id} className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                      {/* Strategy Info */}
                      <div className="flex items-center gap-4 w-full md:w-1/4">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100 relative">
                          <Image 
                            src={s.imageUrl || '/strategy1.svg'} 
                            alt={s.name} 
                            width={32} 
                            height={32} 
                            className="object-contain"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-white bg-blue-500 px-2 py-0.5 rounded-md uppercase tracking-tighter">Master</span>
                          </div>
                          <h4 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">{s.name}</h4>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex flex-col items-center md:w-1/6">
                         <span className="text-[11px] font-bold text-gray-300 uppercase mb-2">Status</span>
                         {renderStatus(r.adminStatus || r.status)}
                      </div>

                      {/* Balance */}
                      <div className="flex flex-col items-center md:w-1/6">
                         <span className="text-[11px] font-bold text-gray-300 uppercase mb-2">Balance</span>
                         <span className="text-base font-bold text-gray-900">{formatCurrency(investedAmount)}</span>
                      </div>

                      {/* Equity */}
                      <div className="flex flex-col items-center md:w-1/6">
                         <span className="text-[11px] font-bold text-gray-300 uppercase mb-2">Equity</span>
                         <span className="text-base font-bold text-gray-900">{formatCurrency(investedAmount)}</span>
                      </div>

                      {/* Float Profit */}
                      <div className="flex flex-col items-center md:w-1/6">
                         <span className="text-[11px] font-bold text-gray-300 uppercase mb-2">Float Profit</span>
                         <span className={`text-base font-bold ${(r.floatProfit || 0) > 0 ? 'text-green-500' : (r.floatProfit || 0) < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                           {formatCurrency(r.floatProfit || 0.00)}
                         </span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Grid Mode
              return (
                <div key={r.id} className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                   <div className="flex items-center justify-between mb-6">
                      <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100">
                         <Image 
                           src={s.imageUrl || '/strategy1.svg'} 
                           alt={s.name} 
                           width={40} 
                           height={40} 
                           className="object-contain"
                         />
                      </div>
                      {renderStatus(r.adminStatus || r.status)}
                   </div>
                   
                   <div className="mb-6">
                      <span className="text-[10px] font-black text-white bg-blue-600 px-2 py-0.5 rounded-md uppercase tracking-tighter mb-2 inline-block">Master</span>
                      <h4 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{s.name}</h4>
                   </div>

                   <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                      <div>
                        <p className="text-[10px] font-bold text-gray-300 uppercase mb-1">Balance</p>
                        <p className="text-base font-bold text-gray-900">{formatCurrency(investedAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-300 uppercase mb-1">Equity</p>
                        <p className="text-base font-bold text-gray-900">{formatCurrency(investedAmount)}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] font-bold text-gray-300 uppercase mb-1">Float Profit</p>
                        <p className={`text-base font-bold ${(r.floatProfit || 0) > 0 ? 'text-green-500' : (r.floatProfit || 0) < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                          {formatCurrency(r.floatProfit || 0.00)}
                        </p>
                      </div>
                   </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {filteredRunning.length > itemsPerPage && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-2 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-all"
            >
              <FiChevronLeft className="w-5 h-5" />
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${currentPage === page ? 'bg-[#ff4d4f] text-white shadow-lg shadow-red-200' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {page}
              </button>
            ))}

            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-2 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-all"
            >
              <FiChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </UserLayout>
  );
};

const RunningStrategiesPage: React.FC = () => {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-900">Loading running strategies...</div>}>
      <RunningStrategiesPageInner />
    </Suspense>
  );
};

export default RunningStrategiesPage;
