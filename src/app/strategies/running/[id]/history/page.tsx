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
import { FiTrendingUp, FiDollarSign, FiTrendingDown } from "react-icons/fi";

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
  const [filter, setFilter] = useState<"all" | "opened" | "closed">("all");
  const [historyPage, setHistoryPage] = useState(1);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [mtStatus, setMtStatus] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [rsId, setRsId] = useState<string | null>(null);
  const [modifications, setModifications] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);

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
      } catch (e) {
        console.error("Failed to load history data:", e);
      } finally {
        setHistoryLoading(false);
      }
    };
    
    setHistoryLoading(true);
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

  const sessions = useMemo(() => {
    const list: Array<{ start: number; end: number | null }> = [];

    // Determine the starting point for sessions. In some cases we may not have a
    // reliable `connectAt` timestamp (e.g. missing data from the backend), so we
    // fall back to the earliest known modification time or the unix epoch.
    let startMs = Number.isFinite(new Date(connectAt || '').getTime())
      ? new Date(connectAt!).getTime()
      : Number.POSITIVE_INFINITY;

    const modTimes = modifications
      .map((m) => (m.created_at ? new Date(m.created_at).getTime() : NaN))
      .filter((t) => Number.isFinite(t));

    if (modTimes.length > 0) {
      startMs = Math.min(startMs, ...modTimes);
    }

    if (!Number.isFinite(startMs)) {
      // If we still don't have a valid start time, show everything.
      return [{ start: 0, end: null }];
    }

    // First session starts at the resolved start time (connectAt or earliest modification)
    let currentSession: { start: number; end: number | null } | null = {
      start: startMs,
      end: null
    };

    // Sort modifications by time
    const sortedMods = [...modifications].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return ta - tb;
    });

    for (const mod of sortedMods) {
      const modTime = mod.created_at ? new Date(mod.created_at).getTime() : 0;
      const status = String(mod.status || '').toLowerCase();

      if (status === 'disconnected' || status === 'stopped') {
        if (currentSession && currentSession.end === null) {
          currentSession.end = modTime;
          list.push(currentSession);
          currentSession = null;
        }
      } else if (status === 'running' || status === 'active') {
        if (!currentSession) {
          currentSession = { start: modTime, end: null };
        }
      }
    }

    if (currentSession) {
      list.push(currentSession);
    }

    // If no sessions were derived, show everything.
    if (list.length === 0) {
      return [{ start: 0, end: null }];
    }

    return list;
  }, [connectAt, modifications]);

  const filteredClosed = useMemo(() => {
    const rows = history.filter((h) => {
      const openMs = toMs(h.server_time_open ?? h.time_open ?? h.open_time ?? h.time);
      const closeMs = toMs(h.server_time_close ?? h.time_close ?? h.close_time ?? h.time);
      
      // Trade is visible only if its open_time is within ANY running session
      const session = sessions.find(s => {
        // If we don't have a valid open time, keep the trade as fallback.
        if (!Number.isFinite(openMs)) return true;
        if (openMs < s.start) return false;
        if (s.end !== null && openMs > s.end) return false;
        return true;
      });

      if (!session) return false;

      // If the trade closed after the session ended, it should have been caught by synthetic closure
      // or it's an invalid state. But we only show it if it closed before or at the session end.
      if (session.end !== null && Number.isFinite(closeMs) && closeMs > session.end) return false;
      
      return true;
    });
    
    return rows.map((h) => {
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
  }, [history, sessions]);

  const filteredOpen = useMemo(() => {
    // Find the currently active session (the one with end === null). This is used
    // to filter open positions to those opened during the most recent running window.
    // If we cannot locate such a session, we still show all open positions as a best-effort.
    const currentSession = sessions.find(s => s.end === null);

    const rows = openPositions.filter((p) => {
      // Handle server_time string vs timestamp
      const openMs = toMs(p.time ?? p.server_time ?? p.open_time ?? p.server_time_open ?? p.time_open);
      if (!Number.isFinite(openMs)) {
        return true;
      }

      if (!currentSession) return true;

      return openMs >= currentSession.start;
    });
    
    return rows.map((p) => {
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
  }, [openPositions, sessions]);

  // Synthesize closures for trades that were open at the end of a session
  const syntheticClosures = useMemo(() => {
    const closures: any[] = [];

    sessions.forEach(session => {
      if (session.end === null) return;

      // Find snapshot at this disconnect time
      const snapshot = snapshots.find(sn => {
        const snTime = sn.snapshot_at ? new Date(sn.snapshot_at).getTime() : 0;
        // Allow 5 minute window
        return Math.abs(snTime - session.end!) < 300000;
      });

      const src = (snapshot && Array.isArray(snapshot.positions)) ? snapshot.positions : openPositions;
      
      const sessionOpenTrades = src.filter((p: any) => {
        const openMs = toMs(p.time ?? p.server_time);
        return Number.isFinite(openMs) && openMs >= session.start && openMs <= session.end!;
      });

      sessionOpenTrades.forEach((p: any) => {
        closures.push({
          isOpen: false as const,
          openTimeStr: p.server_time || p.server_time_open || (p.time_open ? String(p.time_open) : (p.open_time ? String(p.open_time) : (p.time ? String(p.time) : ""))),
          closeTimeStr: new Date(session.end!).toISOString(),
          symbol: p.symbol,
          type: p.type,
          volume: p.volume,
          openPrice: p.price_open,
          closeOrCurrentPrice: p.price_current,
          profit: Number(p.profit),
          swap: Number(p.swap || 0),
        });
      });
    });

    return closures;
  }, [openPositions, sessions, snapshots]);

  const displayRows = useMemo(() => {
    const aStatus = String(adminStatus || '').toLowerCase();
    const mStatus = String(mtStatus || '').toLowerCase();
    const isActuallyRunning = (aStatus === 'running' || aStatus === 'active' || aStatus === 'in-process' || aStatus === 'in process') && 
                               (mStatus === 'running' || mStatus === 'active');
    
    const closedRows = [...filteredClosed, ...(!isActuallyRunning ? syntheticClosures : [])];
    
    if (filter === "opened") return filteredOpen;
    if (filter === "closed") return closedRows.sort((a, b) => {
      const ta = toMs(a.openTimeStr) || 0;
      const tb = toMs(b.openTimeStr) || 0;
      return tb - ta;
    });
    // For 'all' tab, combine both
    const all = [...filteredOpen, ...closedRows];
    return all.sort((a, b) => {
      const ta = toMs(a.openTimeStr) || 0;
      const tb = toMs(b.openTimeStr) || 0;
      return tb - ta;
    });
  }, [filter, filteredOpen, filteredClosed, syntheticClosures, adminStatus, mtStatus]);

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
    const mult = Number.isFinite(lotSize) && lotSize > 0 ? lotSize : 1;

    displayRows.forEach((row: any) => {
      const vol = Number(row.volume) || 0;
      const investment = vol * Number(row.openPrice || 0) * mult;
      const profit = (Number(row.profit) || 0) * mult;

      totalInvestment += investment;
      if (profit >= 0) totalProfit += profit;
      else totalLoss += Math.abs(profit);
    });

    return {
      totalInvestment: totalInvestment.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      totalLoss: totalLoss.toFixed(2)
    };
  }, [displayRows, lotSize]);

  const formatDate = (dateStr: string | number | undefined) => {
    if (!dateStr) return "-";
    // If it already looks like a formatted date string from the server, return it as is
    if (typeof dateStr === "string" && /^\d{4}[\.\-/]\d{2}[\.\-/]\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    const ms = toMs(dateStr);
    if (!Number.isFinite(ms)) return String(dateStr);
    
    // Format to match MT5 style: YYYY.MM.DD HH:MM:SS
    const d = new Date(ms);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <UserLayout>
      <div className="min-h-screen bg-gray-50 text-gray-900 px-6 py-8">
      <div className="max-w-6xl mx-auto pb-16 md:pb-0">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#00d09c] to-[#7c3aed] bg-clip-text text-transparent">View History</h1>
            <p className="text-sm text-gray-600 mt-1">{strategy?.name || "Strategy"} • Lot Size: {lotSize}</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/strategies/running")}>
            Back
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-blue-100">
                <FiDollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-xs text-gray-600 uppercase tracking-wider">Total Investment</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">${stats.totalInvestment}</div>
            <div className="text-sm text-gray-600 mt-1">Total amount invested</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-green-100">
                <FiTrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-xs text-gray-600 uppercase tracking-wider">Total Profit</span>
            </div>
            <div className="text-2xl font-bold text-green-600">${stats.totalProfit}</div>
            <div className="text-sm text-gray-600 mt-1">Total profitable gains</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-red-100">
                <FiTrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <span className="text-xs text-gray-600 uppercase tracking-wider">Total Loss</span>
            </div>
            <div className="text-2xl font-bold text-red-600">${stats.totalLoss}</div>
            <div className="text-sm text-gray-600 mt-1">Total losses incurred</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">
                {filter === "all" ? "All Trades" : filter === "opened" ? "Opened Positions" : "Closed Positions"}
              </h3>
              <span className="text-xs text-gray-500">
                {filter === "closed" ? "Master MT5 History tab (closed trades)" : "Master MT5 position data"}
              </span>
            </div>
            <div className="mt-4 inline-flex rounded-md shadow-sm border border-gray-200 overflow-hidden" role="group">
              <button
                className={`px-4 py-2 text-sm ${filter === "all" ? "bg-primary text-white" : "bg-white text-gray-700"}`}
                onClick={() => setFilter("all")}
              >
                All
              </button>
              <button
                className={`px-4 py-2 text-sm border-l border-gray-200 ${filter === "opened" ? "bg-primary text-white" : "bg-white text-gray-700"}`}
                onClick={() => setFilter("opened")}
              >
                Opened
              </button>
              <button
                className={`px-4 py-2 text-sm border-l border-gray-200 ${filter === "closed" ? "bg-primary text-white" : "bg-white text-gray-700"}`}
                onClick={() => setFilter("closed")}
              >
                Closed
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            {displayRows.length > 0 ? (
              <>
                {/* Desktop / tablet table */}
                <table className="hidden md:table w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="px-6 py-3">Open Time</th>
                      <th className="px-6 py-3">Close Time</th>
                      <th className="px-6 py-3">Symbol</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Volume</th>
                      <th className="px-6 py-3">Open Price</th>
                      <th className="px-6 py-3">{filter === "opened" ? "Current Price" : "Close Price"}</th>
                      <th className="px-6 py-3">Swap</th>
                      <th className="px-6 py-3">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedRows.map((pos, idx) => {
                      const isBuy = String(pos.type).toUpperCase().includes('BUY') || pos.type === 0 || pos.type === "0";
                      const mult = Number.isFinite(lotSize) && lotSize > 0 ? lotSize : 1;
                      const vol = Number((pos as any).volume) || 0;
                      const swapVal = (Number((pos as any).swap) || 0) * mult;
                      const profitVal = (Number((pos as any).profit) || 0) * mult;
                      return (
                        <tr key={`${pos.symbol}-${pos.openTimeStr}-${idx}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                            {formatDate(pos.openTimeStr)}
                          </td>
                          <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                            {formatDate(pos.closeTimeStr)}
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900">{pos.symbol}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                isBuy ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                              }`}
                            >
                              {isBuy ? "BUY" : "SELL"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-600">{(vol * mult).toFixed(2)}</td>
                          <td className="px-6 py-4 text-gray-600">
                            {pos.openPrice && Number(pos.openPrice) !== 0 ? pos.openPrice : "-"}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {pos.closeOrCurrentPrice && Number(pos.closeOrCurrentPrice) !== 0 ? pos.closeOrCurrentPrice : "-"}
                          </td>
                          <td className={`px-6 py-4 font-medium ${swapVal >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {swapVal > 0 ? "+" : ""}{swapVal.toFixed(2)}
                          </td>
                          <td className={`px-6 py-4 font-bold ${profitVal >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {profitVal >= 0 ? "+" : ""}{profitVal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Mobile card list (white theme) */}
                <div className="md:hidden divide-y divide-gray-200 bg-white">
                  {paginatedRows.map((pos, idx) => {
                    const isBuy = String(pos.type).toUpperCase().includes("BUY") || pos.type === 0 || pos.type === "0";
                    const mult = Number.isFinite(lotSize) && lotSize > 0 ? lotSize : 1;
                    const vol = Number((pos as any).volume) || 0;
                    const swapVal = (Number((pos as any).swap) || 0) * mult;
                    const profitVal = (Number((pos as any).profit) || 0) * mult;
                    const isProfitPositive = profitVal >= 0;

                    return (
                      <div
                        key={`${pos.symbol}-${pos.openTimeStr}-${idx}`}
                        className="px-4 py-3 flex flex-col gap-2 bg-white"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                              {pos.symbol}
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  isBuy ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                }`}
                              >
                                {isBuy ? "BUY" : "SELL"}
                              </span>
                            </p>
                            <p className="text-[11px] text-gray-500">
                              Open: {formatDate(pos.openTimeStr)}
                            </p>
                            {pos.closeTimeStr && (
                              <p className="text-[11px] text-gray-400">
                                Close: {formatDate(pos.closeTimeStr)}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-sm font-bold ${
                                isProfitPositive ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {isProfitPositive ? "+" : ""}
                              {profitVal.toFixed(2)}
                            </p>
                            <p className="text-[11px] text-gray-500">Profit</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
                          <div className="flex flex-col">
                            <span className="uppercase tracking-wide">Volume</span>
                            <span className="text-gray-900 font-medium">
                              {(vol * mult).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="uppercase tracking-wide">
                              {filter === "opened" ? "Current" : "Close"} Price
                            </span>
                            <span className="text-gray-900 font-medium">
                              {pos.closeOrCurrentPrice && Number(pos.closeOrCurrentPrice) !== 0
                                ? pos.closeOrCurrentPrice
                                : "-"}
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="uppercase tracking-wide">Swap</span>
                            <span
                              className={`font-medium ${
                                swapVal >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {swapVal > 0 ? "+" : ""}
                              {swapVal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 bg-gray-50">
                    <p className="text-sm text-gray-600">
                      Showing {(currentPage - 1) * ENTRIES_PER_PAGE + 1}–{Math.min(currentPage * ENTRIES_PER_PAGE, displayRows.length)} of {displayRows.length} entries
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-1.5 text-sm font-medium rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-12 text-center text-gray-500 text-sm">
                {historyLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
                    <span>Syncing trades...</span>
                  </div>
                ) : historyError ? historyError : 'No trades yet since activation.'}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </UserLayout>
  );
}
