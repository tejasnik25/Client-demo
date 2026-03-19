"use client";

/**
 * Copier History page (Octa Copy–style): shows Master's MT5 trades to the copying user.
 * - Strategy has Master A linked (admin). User A pays for Strategy A → after approval, sees it here.
 * - "Opened" tab = Master A's current open positions on MT5 (same as Terminal → Trade).
 * - "Closed" tab = Master A's closed positions (same as MT5 Terminal → History tab).
 * Data comes from master-history API (live from MT5 via Python trading service, no cache).
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Button from "@/components/ui/Button";
import UserLayout from "@/components/UserLayout";
import { FiChevronLeft, FiChevronRight, FiPlusCircle, FiMinusCircle, FiXCircle, FiExternalLink, FiChevronDown } from "react-icons/fi";

type HistoryItem = {
  position_id?: string;
  time_open?: number | string;
  time_close?: number | string;
  server_time_open?: string;
  server_time_close?: string;
  open_time?: number | string;
  close_time?: number | string;
  time?: number | string;
  symbol: string;
  type: number | string;
  volume: number;
  price_open: number;
  price_close: number;
  profit: number;
  swap?: number;
};

type OpenItem = {
  server_time?: string;
  server_time_open?: string;
  time?: number | string;
  open_time?: number | string;
  time_open?: number | string;
  symbol: string;
  type: number | string;
  volume: number;
  price_open: number;
  price_current: number;
  profit: number;
  swap?: number;
};

type Strategy = {
  id: string;
  name: string;
  parameters: Record<string, string>;
};

type Payment = {
  userId: string;
  strategyId: string;
  payable: number;
  status: string;
  createdAt?: string;
};

export default function CopierHistoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [openPositions, setOpenPositions] = useState<OpenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [connectAt, setConnectAt] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filter, setFilter] = useState<"opened" | "closed" | "balance">("closed");
  const [historyPage, setHistoryPage] = useState(1);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [mtStatus, setMtStatus] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [rsId, setRsId] = useState<string | null>(null);
  const [modifications, setModifications] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [stratRes, paymentsRes, profileRes] = await Promise.all([
          fetch("/api/strategies", { cache: "no-store" }),
          fetch("/api/payments", { cache: "no-store" }),
          fetch("/api/profile", { cache: "no-store" }).catch(() => null),
        ]);
        const stratData = await stratRes.json();
        const s = (stratData.strategies || []).find((x: any) => x.id === params.id);
        setStrategy(s || null);
        const payJson = await paymentsRes.json();
        setPayments(payJson.payments || []);
        if (profileRes && profileRes.ok) {
          const profile = await profileRes.json().catch(() => null);
          setSessionUserId(profile?.user?.id || null);
          setUserProfile(profile?.user || null);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.id]);

  // Remember last trades page for bottom nav
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (pathname?.includes("/strategies/running") && pathname?.includes("/history")) {
        window.localStorage.setItem("last_trades_path", pathname);
      }
    } catch {
      // ignore
    }
  }, [pathname]);

  // Hydrate instantly from localStorage cache (best-effort) to avoid initial delay.
  useEffect(() => {
    if (!params.id) return;
    if (typeof window === "undefined") return;
    try {
      const key = `copier_history_cache_${params.id}`;
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.history) && parsed.history.length > 0) setHistory(parsed.history);
      if (Array.isArray(parsed?.open_positions) && parsed.open_positions.length > 0) setOpenPositions(parsed.open_positions);
    } catch {
      // ignore
    }
  }, [params.id]);
  useEffect(() => {
    const loadHistory = async () => {
      if (!params.id) return;
      try {
        const [hRes, runRes] = await Promise.all([
          fetch(`/api/strategies/${params.id}/master-history?t=${Date.now()}`, { cache: "no-store" }),
          fetch(`/api/strategies/running`, { cache: "no-store" })
        ]);
        const data = await hRes.json();
        
        setHistory(data.history || []);
        setOpenPositions(data.open_positions || []);

        // Persist latest known-good data for instant display on next visit.
        if (typeof window !== "undefined") {
          try {
            const key = `copier_history_cache_${params.id}`;
            window.localStorage.setItem(
              key,
              JSON.stringify({
                history: data.history || [],
                open_positions: data.open_positions || [],
                saved_at: Date.now(),
              })
            );
          } catch {
            // ignore
          }
        }
        
        setHistoryError(data.error || null);
        const runData = await runRes.json().catch(() => null);
        const me = Array.isArray(runData?.strategies) ? runData.strategies.find((x: any) => (x.id === params.id || x.strategyId === params.id)) : null;
        
        if (!me) {
          console.warn("No matching running strategy found for current user session.");
          return;
        }
        
        const aStatus = String(me?.adminStatus || '').toLowerCase();
        const mStatus = String(me?.status || '').toLowerCase();
        setAdminStatus(me?.adminStatus || null);
        setMtStatus(me?.status || null);
        
        // isRunningLike: either fully running OR in-process of disconnecting
        const isRunningLike = aStatus === 'running' || aStatus === 'active' || 
                             ((aStatus === 'in-process' || aStatus === 'in process') && (mStatus === 'running' || mStatus === 'active'));
        
        // Effective connection time for filtering: Always use the original creation time
        // of the running strategy record (when the strategy was first approved/purchased).
        const connectedAt = me?.createdAt || null;
        setConnectAt(connectedAt);
        setUpdatedAt(me?.updatedAt || null);
        setRsId(me?.rsId || null);
        setModifications(me?.modifications || []);
        setSnapshots(me?.snapshots || []);
      } catch (e: any) {
        console.error("Failed to load history data:", e);
        setHistoryError(e?.message || "Failed to load history data. Please check connection.");
      } finally {
        setHistoryLoading(false);
      }
    };
    
    // Only show loading if nothing is available yet.
    setHistoryLoading(history.length === 0 && openPositions.length === 0);
    loadHistory();

    const timer = setInterval(loadHistory, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadHistory();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [params.id]);



  const lotSize = useMemo(() => {
    const lp = strategy?.parameters?.lotPricing;
    const rows: Array<{ amountUSD: number; lot: number }> = (() => {
      if (!lp) return [];
      try {
        const arr = JSON.parse(lp);
        if (!Array.isArray(arr)) return [];
        return arr
          .map((x: any) => ({ amountUSD: Number(x.amountUSD), lot: Number(x.lot) }))
          .filter((x) => Number.isFinite(x.amountUSD) && x.amountUSD > 0 && Number.isFinite(x.lot) && x.lot > 0);
      } catch {
        return [];
      }
    })();

    const userId = sessionUserId;
    const relevant = payments
      .filter((p) => p.strategyId === params.id && (!userId || p.userId === userId))
      .sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      });
    const p = relevant.find((x) => {
      const st = String(x.status || '').toLowerCase();
      return st === 'approved' || st === 'completed' || st === 'renewal_approved' || st === 'in-process';
    });
    const amt = p?.payable ? Number(p.payable) : NaN;
    if (!Number.isFinite(amt) || rows.length === 0) return 1;
    const exact = rows.find((r) => Math.abs(r.amountUSD - amt) < 1e-6);
    if (exact) return exact.lot;
    let best = rows[0];
    let diff = Math.abs(rows[0].amountUSD - amt);
    for (let i = 1; i < rows.length; i++) {
      const d = Math.abs(rows[i].amountUSD - amt);
      if (d < diff) {
        diff = d;
        best = rows[i];
      }
    }
    return best.lot;
  }, [strategy?.parameters, payments, params.id, sessionUserId]);

  const toMs = (v: string | number | undefined): number => {
    if (v == null || v === "") return NaN;
    if (typeof v === "string") {
      // 1. Try native parsing (e.g. ISO)
      let t = Date.parse(v);
      
      // 2. Handle MT5 style with dots (e.g. 2026.02.25 14:30:00)
      if (!Number.isFinite(t)) {
        t = Date.parse(v.replace(/\./g, '-'));
      }
      
      // 3. Manual parse for "YYYY.MM.DD HH:MM:SS" if still failing
      if (!Number.isFinite(t)) {
        const m = v.match(/^(\d{4})[\.\-/](\d{2})[\.\-/](\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
        if (m) {
          const [_, yy, MM, dd, hh, mm, ss] = m;
          const d = new Date(
            Number(yy),
            Number(MM) - 1,
            Number(dd),
            Number(hh),
            Number(mm),
            Number(ss)
          );
          t = d.getTime();
        }
      }
      return Number.isFinite(t) ? t : NaN;
    }
    const num = Number(v);
    if (!Number.isFinite(num)) return NaN;
    // MT5 timestamps are in seconds, JS in milliseconds. 
    // Heuristic: If < 10^12, it's probably seconds.
    return num < 10000000000 ? num * 1000 : num;
  };

  const filteredClosed = useMemo(() => {
    return history.map((h) => {
      return {
        isOpen: false as const,
        openTimeStr: h.server_time_open || (h.time_open ? String(h.time_open) : (h.open_time ? String(h.open_time) : "")),
        closeTimeStr: h.server_time_close || (h.time_close ? String(h.time_close) : (h.close_time ? String(h.close_time) : "")),
        symbol: h.symbol,
        type: h.type,
        volume: h.volume,
        openPrice: h.price_open,
        closeOrCurrentPrice: h.price_close,
        profit: Number(h.profit),
        swap: Number(h.swap || 0),
      };
    });
  }, [history]);

  const filteredOpen = useMemo(() => {
    return openPositions.map((p) => {
      return {
        isOpen: true as const,
        openTimeStr: p.server_time || p.server_time_open || (p.time_open ? String(p.time_open) : (p.open_time ? String(p.open_time) : (p.time ? String(p.time) : ""))),
        closeTimeStr: "",
        symbol: p.symbol,
        type: p.type,
        volume: p.volume,
        openPrice: p.price_open,
        closeOrCurrentPrice: p.price_current,
        profit: Number(p.profit),
        swap: Number(p.swap || 0),
      };
    });
  }, [openPositions]);

  const displayRows = useMemo(() => {
    const closedRows = [...filteredClosed];
    
    if (filter === "opened") return filteredOpen;
    if (filter === "closed") return closedRows.sort((a, b) => {
      const ta = toMs(a.closeTimeStr) || 0;
      const tb = toMs(b.closeTimeStr) || 0;
      return sortOrder === "desc" ? tb - ta : ta - tb;
    });
    // For 'balance' tab, return empty or balance operations if available
    return [];
  }, [filter, filteredOpen, filteredClosed, sortOrder]);

  const ENTRIES_PER_PAGE = 20;
  const totalPages = Math.max(1, Math.ceil(displayRows.length / ENTRIES_PER_PAGE));
  const currentPage = Math.min(historyPage, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ENTRIES_PER_PAGE;
    return displayRows.slice(start, start + ENTRIES_PER_PAGE);
  }, [displayRows, currentPage]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setHistoryPage(1);
  }, [filter]);

  // Clamp page when total pages shrinks (e.g. data refresh)
  useEffect(() => {
    if (historyPage > totalPages && totalPages >= 1) setHistoryPage(totalPages);
  }, [historyPage, totalPages]);

  const stats = useMemo(() => {
    let totalInvestment = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let totalSwap = 0;
    let totalCommission = 0;
    const mult = Number.isFinite(lotSize) && lotSize > 0 ? lotSize : 1;

    // Calculate stats based on closed history
    filteredClosed.forEach((row: any) => {
      const vol = Number(row.volume) || 0;
      const investment = vol * Number(row.openPrice || 0) * mult;
      const profit = (Number(row.profit) || 0) * mult;
      const swap = (Number(row.swap) || 0) * mult;

      totalInvestment += investment;
      totalSwap += swap;
      if (profit >= 0) totalProfit += profit;
      else totalLoss += Math.abs(profit);
    });

    const netProfit = totalProfit - totalLoss + totalSwap;

    return {
      totalInvestment: totalInvestment.toFixed(2),
      totalProfit: (totalProfit - totalLoss).toFixed(2),
      totalSwap: totalSwap.toFixed(2),
      totalCommission: totalCommission.toFixed(2),
      balance: (Number(userProfile?.wallet_balance || 0)).toFixed(2),
      floatPL: netProfit.toFixed(2)
    };
  }, [filteredClosed, lotSize, userProfile]);

  const getSymbolIcon = (symbol: string) => {
    const s = symbol.toUpperCase();
    if (s.includes('XAU') || s.includes('GOLD')) return 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/gold.png';
    if (s.includes('BTC')) return 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/btc.png';
    if (s.includes('ETH')) return 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/eth.png';
    if (s.includes('USD')) return 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/usd.png';
    if (s.includes('EUR')) return 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/eur.png';
    if (s.includes('GBP')) return 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/gbp.png';
    if (s.includes('JPY')) return 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/jpy.png';
    return 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/usd.png';
  };

  const getFlagIcon = (symbol: string) => {
    const s = symbol.toUpperCase();
    if (s.includes('USD')) return 'https://flagcdn.com/w20/us.png';
    if (s.includes('EUR')) return 'https://flagcdn.com/w20/eu.png';
    if (s.includes('GBP')) return 'https://flagcdn.com/w20/gb.png';
    if (s.includes('JPY')) return 'https://flagcdn.com/w20/jp.png';
    if (s.includes('AUD')) return 'https://flagcdn.com/w20/au.png';
    if (s.includes('CAD')) return 'https://flagcdn.com/w20/ca.png';
    return null;
  };

  const formatDateShort = (dateStr: string | number | undefined) => {
    if (!dateStr) return "-";
    const ms = toMs(dateStr);
    if (!Number.isFinite(ms)) return String(dateStr);
    const d = new Date(ms);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())} ${months[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  // Get country info for flag
  const countryInfo = useMemo(() => {
    if (!userProfile?.country) return { code: 'us', name: 'USA' };
    
    // Use the same COUNTRY_OPTIONS as UserLayout/Signup
    // Assuming COUNTRY_OPTIONS is available or we can find it
    // For now, if userProfile has it, use it, else default to US.
    return {
      code: userProfile?.country_code || 'us',
      name: userProfile?.country || 'USA'
    };
  }, [userProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <UserLayout>
      <div className="min-h-screen bg-[#f1f3f6] text-gray-900 px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Master Strategy Info Container */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border border-gray-100">
                  <img 
                    src={strategy?.parameters?.image || "/user-avatar.png"} 
                    alt={strategy?.name || "Master"} 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://www.w3schools.com/howto/img_avatar.png";
                    }} 
                  />
                </div>
                <div className="absolute -bottom-1 -left-1 bg-[#00d09c] text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase">
                  Equal x{lotSize}
                </div>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 leading-tight">
                  {strategy?.name || "NinjaTraders"}
                </h2>
                <span className="inline-block mt-1 px-3 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-md uppercase">
                  Master
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 md:gap-10">
              <button className="flex items-center gap-2 text-[#00d09c] text-xs font-bold uppercase tracking-tight hover:opacity-80 transition-opacity">
                <FiPlusCircle className="w-4 h-4" />
                Add Investment
              </button>
              <button className="flex items-center gap-2 text-gray-700 text-xs font-bold uppercase tracking-tight hover:opacity-80 transition-opacity">
                <FiMinusCircle className="w-4 h-4" />
                Reduce Investment
              </button>
              <button className="flex items-center gap-2 text-gray-900 text-xs font-bold uppercase tracking-tight hover:opacity-80 transition-opacity">
                <FiXCircle className="w-4 h-4" />
                Stop Copying
              </button>
              <button 
                onClick={() => router.push(`/strategies/${params.id}/info`)}
                className="flex items-center gap-2 text-gray-900 text-xs font-bold uppercase tracking-tight hover:opacity-80 transition-opacity"
              >
                <FiExternalLink className="w-4 h-4" />
                Master's Performance
              </button>
              <button className="p-1 text-gray-400 hover:text-gray-600">
                <FiChevronDown className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Top Info Container */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                <img src="/user-avatar.png" alt="User" className="w-full h-full object-cover" onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://www.w3schools.com/howto/img_avatar.png";
                }} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 leading-tight">
                  {userProfile?.name || "User Name"}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <img 
                    src={`https://flagcdn.com/w20/${countryInfo.code.toLowerCase()}.png`} 
                    alt="" 
                    className="w-4 h-3 object-contain"
                  />
                  <span className="text-sm text-gray-400 font-medium">
                    {countryInfo.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-12 md:gap-16 lg:gap-24">
              <div className="text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Status</p>
                <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  (adminStatus === 'running' || adminStatus === 'active') 
                  ? "bg-[#00d09c] text-white" 
                  : "bg-red-500 text-white"
                }`}>
                  {(adminStatus === 'running' || adminStatus === 'active') ? "Copying" : "Stopped"}
                </span>
              </div>

              <div className="text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Lot-size mode</p>
                <p className="text-lg font-black text-gray-900">Equal X {lotSize}</p>
              </div>

              <div className="text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Leverage</p>
                <p className="text-lg font-black text-gray-900">1.500</p>
              </div>

              <div className="text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Commission</p>
                <p className="text-lg font-black text-gray-900">30%</p>
              </div>
            </div>
          </div>

          {/* History Container */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6">History</h2>
            
            {/* Tabs */}
            <div className="flex items-center gap-8 border-b border-gray-100 mb-8">
              <button
                onClick={() => setFilter("closed")}
                className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
                  filter === "closed" ? "border-[#00d09c] text-[#00d09c]" : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Closed Orders
              </button>
              <button
                onClick={() => setFilter("opened")}
                className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
                  filter === "opened" ? "border-[#00d09c] text-[#00d09c]" : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Open Orders ({filteredOpen.length})
              </button>
              <button
                onClick={() => setFilter("balance")}
                className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${
                  filter === "balance" ? "border-[#00d09c] text-[#00d09c]" : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Balance Operations
              </button>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-12 items-center text-center">
              <div className="px-4 border-r border-gray-100 last:border-0">
                <p className="text-2xl font-black text-gray-900">${stats.totalInvestment}</p>
                <p className="text-xs font-bold text-gray-400 uppercase mt-1">Deposit</p>
              </div>
              <div className="px-4 border-r border-gray-100 last:border-0">
                <p className="text-2xl font-black text-gray-900">$0.00</p>
                <p className="text-xs font-bold text-gray-400 uppercase mt-1">Withdrawal</p>
              </div>
              <div className="px-4 border-r border-gray-100 last:border-0">
                <p className={`text-2xl font-black ${Number(stats.totalProfit) >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                  ${stats.totalProfit}
                </p>
                <p className="text-xs font-bold text-gray-400 uppercase mt-1">Profit</p>
              </div>
              <div className="px-4 border-r border-gray-100 last:border-0">
                <p className="text-2xl font-black text-gray-900">1:500</p>
                <p className="text-xs font-bold text-gray-400 uppercase mt-1">Swap</p>
              </div>
              <div className="px-4 border-r border-gray-100 last:border-0">
                <p className="text-2xl font-black text-gray-900">${stats.totalCommission}</p>
                <p className="text-xs font-bold text-gray-400 uppercase mt-1">Commission</p>
              </div>
              <div className="px-4 border-r border-gray-100 last:border-0">
                <p className="text-2xl font-black text-gray-900">${filter === 'opened' ? stats.floatPL : stats.balance}</p>
                <p className="text-xs font-bold text-gray-400 uppercase mt-1">{filter === 'opened' ? 'Float P/L' : 'Balance'}</p>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-gray-400 uppercase border-b border-gray-50">
                    <th className="px-6 py-4">Symbol</th>
                    <th className="px-6 py-4 text-center">Type</th>
                    <th className="px-6 py-4">Opening time, UTC</th>
                    {filter === 'closed' && (
                      <th 
                        className="px-6 py-4 cursor-pointer hover:text-gray-600 transition-colors flex items-center gap-1"
                        onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
                      >
                        Closing time, UTC {sortOrder === "desc" ? "↓" : "↑"}
                      </th>
                    )}
                    <th className="px-6 py-4 text-center">Lots</th>
                    <th className="px-6 py-4 text-right">Opening price</th>
                    <th className="px-6 py-4 text-right">Closing price</th>
                    <th className="px-6 py-4 text-right">Profit, USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                {paginatedRows.length > 0 ? (
                  paginatedRows.map((pos, idx) => {
                    const isBuy = String(pos.type).toUpperCase().includes('BUY') || pos.type === 0 || pos.type === "0";
                    const mult = Number.isFinite(lotSize) && lotSize > 0 ? lotSize : 1;
                    const vol = (Number(pos.volume) || 0) * mult;
                    const profitVal = (Number(pos.profit) || 0) * mult;
                    const symbolIcon = getSymbolIcon(pos.symbol || '');
                    const flagIcon = getFlagIcon(pos.symbol || '');

                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img src={symbolIcon} alt="" className="w-6 h-6 rounded-full" />
                              {flagIcon && (
                                <img 
                                  src={flagIcon} 
                                  alt="" 
                                  className="w-3.5 h-3.5 rounded-full absolute -bottom-1 -right-1 border border-white" 
                                />
                              )}
                            </div>
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-tight">
                              {pos.symbol}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border ${
                            isBuy 
                            ? "text-blue-400 border-blue-100 bg-blue-50/30" 
                            : "text-red-400 border-red-100 bg-red-50/30"
                          }`}>
                            {isBuy ? "Buy" : "Sell"}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-xs font-bold text-gray-500">
                          {formatDateShort(pos.openTimeStr)}
                        </td>
                        {filter === 'closed' && (
                          <td className="px-6 py-5 text-xs font-bold text-gray-500">
                            {formatDateShort(pos.closeTimeStr)}
                          </td>
                        )}
                        <td className="px-6 py-5 text-xs font-bold text-gray-500 text-center">
                          {vol.toFixed(2)}
                        </td>
                        <td className="px-6 py-5 text-xs font-bold text-gray-500 text-right">
                          {pos.openPrice ? Number(pos.openPrice).toFixed(pos.symbol?.includes('JPY') ? 3 : 5) : "-"}
                        </td>
                        <td className="px-6 py-5 text-xs font-bold text-gray-500 text-right">
                          {pos.closeOrCurrentPrice ? Number(pos.closeOrCurrentPrice).toFixed(pos.symbol?.includes('JPY') ? 3 : 5) : "-"}
                        </td>
                        <td className={`px-6 py-5 text-xs font-bold text-right ${profitVal >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {profitVal >= 0 ? "" : "-"}{Math.abs(profitVal).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={filter === 'closed' ? 8 : 7} className="px-6 py-20 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                      {historyLoading ? "Loading orders..." : "No orders found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-8 border-t border-gray-50">
              <button
                onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              >
                <FiChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setHistoryPage(p)}
                    className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                      currentPage === p ? "bg-[#00d09c] text-white" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              >
                <FiChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  </UserLayout>
);
}
