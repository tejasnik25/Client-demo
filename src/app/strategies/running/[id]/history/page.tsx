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
  price?: number;
  profit: number;
  swap?: number;
  swap_amount?: number;
  swapAmount?: number;
};

type Strategy = {
  id: string;
  name: string;
  parameters: Record<string, string>;
  planDetails?: Record<string, any>;
};

type Payment = {
  userId?: string;
  strategyId?: string;
  payable?: number;
  status?: string;
  createdAt?: string;
  strategy_id?: string;
  user_id?: string;
  amount?: number;
  created_at?: string;
  runningStrategyId?: string;
  running_strategy_id?: string;
  payable_amount?: number;
};

type Plan = "Pro" | "Expert" | "Premium";

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
  const [historyInfo, setHistoryInfo] = useState<string | null>(null);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [realtimeFetchFailed, setRealtimeFetchFailed] = useState(false);
  const [historyUpdatedAt, setHistoryUpdatedAt] = useState<string | null>(null);
  const [connectAt, setConnectAt] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filter, setFilter] = useState<"opened" | "closed" | "balance">("closed");
  const [historyPage, setHistoryPage] = useState(1);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [mtStatus, setMtStatus] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [rsId, setRsId] = useState<string | null>(null);
  const [runningPeriods, setRunningPeriods] = useState<any[]>([]);
  const [modifications, setModifications] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [runningCapital, setRunningCapital] = useState<number>(0);
  const [isStopRequesting, setIsStopRequesting] = useState<boolean>(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const strategyStatus = useMemo(() => {
    const raw = `${adminStatus || ""} ${mtStatus || ""}`.toLowerCase();
    if (raw.includes("in-process") || raw.includes("in process")) {
      return { label: "In-Process", isActive: false };
    }
    if (raw.includes("running") || raw.includes("copying") || raw.includes("active")) {
      return { label: "Running/Copying", isActive: true };
    }
    if (raw.includes("stopped") || raw.includes("idle") || raw.includes("offline") || raw.includes("disconnected")) {
      return { label: "Stopped", isActive: false };
    }
    // Fallback until proper status is fetched
    return { label: "Stopped", isActive: false };
  }, [adminStatus, mtStatus]);

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

  // Clear cache when strategy is deleted/disconnected
  useEffect(() => {
    if (!params.id || !rsId) return;
    
    // If we have rsId but no running strategy found, strategy was likely deleted
    if (rsId && !adminStatus && !mtStatus) {
      console.log(`[StrategyCleanup] Strategy ${params.id} appears to be deleted, clearing cache`);
      try {
        const cacheKey = `copier_history_cache_${params.id}`;
        window.localStorage.removeItem(cacheKey);
        console.log(`[StrategyCleanup] Cleared cache for deleted strategy: ${cacheKey}`);
      } catch (error) {
        console.error('Error clearing cache for deleted strategy:', error);
      }
    }
  }, [params.id, rsId, adminStatus, mtStatus]);

  const requestStopCopying = async () => {
    if (!rsId) {
      alert("Running strategy session not found.");
      return;
    }
    if (!confirm("Are you sure you want to stop copying? This will request admin approval.")) return;
    setIsStopRequesting(true);
    try {
      const res = await fetch(`/api/running-strategies/${rsId}/modification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Stop-copy request failed');
      alert("Stop request submitted. Admin will review and process.");
      setAdminStatus('in-process');
      setMtStatus('running');
      // keep current copy behavior until admin approves
    } catch (e: any) {
      console.error('Stop-copying request failed:', e);
      alert(`Failed to submit request: ${e.message || 'Unknown error'}`);
    } finally {
      setIsStopRequesting(false);
    }
  };

  // Hydrate instantly from localStorage cache (best-effort) to reduce UI flash.
  // For open positions we prefer real-time only; cache fallback is only for closed history.
  useEffect(() => {
    if (!params.id) return;
    if (typeof window === "undefined") return;
    try {
      const key = `copier_history_cache_${params.id}`;
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.history) && parsed.history.length > 0) {
        setHistory(parsed.history);
        setHistoryLoading(false);
      }
      // don't use cached open positions; we require realtime open data
      setOpenPositions([]);
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

        // Real-time data must be used if available;
        // if we are forced to cache, only use close-history fallback, not open positions.
        if (!data.cached) {
          setRealtimeFetchFailed(false);
          setOpenPositions(data.open_positions || []);
        } else {
          setRealtimeFetchFailed(true);
          setOpenPositions([]); // do not show stale open data when realtime unavailable
        }

        setHistory(data.history || []);
        setHistoryInfo(data.info || null);
        setHistoryUpdatedAt(data.last_updated || null);
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
        setUsingCachedData(Boolean(data.cached));
        const runData = await runRes.json().catch(() => null);
        const me = Array.isArray(runData?.strategies) ? runData.strategies.find((x: any) => (x.id === params.id || x.rsId === params.id || x.strategyId === params.id)) : null;
        
        if (!me) {
          console.warn("No matching running strategy found for current user session.");
          return;
        }

        // If we found me, and strategy is still null, try to set it from the strategies we already loaded
        if (!strategy && me.strategyId) {
          fetch("/api/strategies", { cache: "no-store" })
            .then(res => res.json())
            .then(stratData => {
              const s = (stratData.strategies || []).find((x: any) => x.id === me.strategyId);
              if (s) setStrategy(s);
            })
            .catch(() => null);
        }
        
        const aStatus = String(me?.adminStatus || '').toLowerCase();
        const mStatus = String(me?.status || '').toLowerCase();
        setAdminStatus(me?.adminStatus || null);
        setMtStatus(me?.status || null);
        setSelectedPlan((me?.plan as Plan | undefined) ?? null);
        
        // isRunningLike: either fully running OR in-process of disconnecting
        const isRunningLike = aStatus === 'running' || aStatus === 'active' || 
                             ((aStatus === 'in-process' || aStatus === 'in process') && (mStatus === 'running' || mStatus === 'active'));
        
        // Effective connection time for filtering: Always use the original creation time
        // of the running strategy record (when the strategy was first approved/purchased).
        const connectedAt = me?.createdAt || me?.created_at || null;
        setConnectAt(connectedAt);
        setUpdatedAt(me?.updatedAt || null);
        setRsId(me?.rsId || null);
        setRunningPeriods(me?.periods || []);
        setModifications(me?.modifications || []);
        setSnapshots(me?.snapshots || []);
        setRunningCapital(Number(me?.capital || 0));
        
        // Fetch settlements
        if (me?.rsId) {
          try {
            const sRes = await fetch(`/api/strategies/running/${me.rsId}/settlements`);
            if (sRes.ok) {
              const sData = await sRes.json();
              setSettlements(sData.settlements || []);
            }
          } catch (err) {
            console.error('Error fetching settlements:', err);
          }
        }
      } catch (e: any) {
        console.error("Failed to load history data:", e);

        // Try to restore cached values when live endpoint is down
        if (typeof window !== "undefined") {
          try {
            const key = `copier_history_cache_${params.id}`;
            const raw = window.localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed?.history) || Array.isArray(parsed?.open_positions)) {
                setHistory(Array.isArray(parsed.history) ? parsed.history : []);
                setOpenPositions([]); // only close history fallback, no old open data
                setHistoryError("Live data is unavailable, showing cached close history.");
                setUsingCachedData(true);
                setRealtimeFetchFailed(true);
                setHistoryLoading(false);
                return;
              }
            }
          } catch (cacheErr) {
            console.warn("Failed to read cached history data:", cacheErr);
          }
        }

        setHistoryError(e?.message || "Failed to load history data. Please check connection.");
      } finally {
        setHistoryLoading(false);
      }
    };
    
    // Don't force loading overlay if we have cached data; let history and open positions render directly.
    setHistoryLoading(false);
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

  const toMs = (v: string | number | null | undefined): number => {
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
    return history
      .filter(h => {
        const openRaw = h.server_time_open ?? h.time_open ?? h.open_time ?? h.time;
        const closeRaw = h.server_time_close ?? h.time_close ?? h.close_time ?? h.time;
        const openMs = toMs(openRaw);
        const closeMs = toMs(closeRaw);
        if (!Number.isFinite(openMs) && !Number.isFinite(closeMs)) return true;

        const effectiveMs = Number.isFinite(openMs) ? openMs : closeMs;

        // If no running periods yet, fallback to connectedAt and require trade opened after connect time
        if (runningPeriods.length === 0) {
          const connectTs = connectAt ? toMs(connectAt) : NaN;
          if (!Number.isFinite(connectTs)) return true;

          if (Number.isFinite(openMs)) {
            return openMs >= connectTs;
          }
          if (Number.isFinite(closeMs)) {
            return closeMs >= connectTs;
          }
          return true;
        }

        // Check if trade open time is within ANY of the running periods
        const inPeriod = runningPeriods.some(period => {
          const start = toMs(period.start_time);
          const end = period.end_time ? toMs(period.end_time) : Infinity;

          if (Number.isFinite(openMs) && Number.isFinite(closeMs)) {
            // Include trades that were active during the running period,
            // even if the position opened before the period started and closed afterward.
            return openMs <= end && closeMs >= start;
          }

          if (Number.isFinite(openMs)) {
            return openMs >= start && openMs <= end;
          }

          if (Number.isFinite(closeMs)) {
            return closeMs >= start && closeMs <= end;
          }

          return false;
        });

        return inPeriod;
      })
      .map((h) => {
        const openRaw = h.server_time_open ?? h.time_open ?? h.open_time ?? h.time;
        const closeRaw = h.server_time_close ?? h.time_close ?? h.close_time ?? h.time;
        return {
          isOpen: false as const,
          openTimeStr: openRaw != null ? String(openRaw) : "",
          closeTimeStr: closeRaw != null ? String(closeRaw) : "",
          symbol: h.symbol,
          type: h.type,
          volume: h.volume,
          openPrice: h.price_open,
          closeOrCurrentPrice: h.price_close,
          profit: Number(h.profit),
          swap: Number(h.swap || 0),
        };
      });
  }, [history, connectAt, runningPeriods]);

  const filteredOpen = useMemo(() => {
    // For open positions, we only show those that were opened while the user was 'running'.
    return openPositions
      .filter(p => {
        const openMs = toMs(p.server_time || p.server_time_open || p.time_open || p.open_time || p.time);
        if (!Number.isFinite(openMs)) return true;

        // Fallback to connectedAt if no periods
        if (runningPeriods.length === 0) {
          const connectTs = connectAt ? toMs(connectAt) : NaN;
          const startTs = Number.isFinite(connectTs) ? connectTs : 0;
          return openMs >= startTs;
        }

        // Check if openMs falls within ANY of the running periods
        const inPeriod = runningPeriods.some(period => {
          const start = toMs(period.start_time);
          const end = period.end_time ? toMs(period.end_time) : Infinity;
          return openMs >= start && openMs <= end;
        });

        // Also include trades that were opened BEFORE the first period but closed AFTER it started
        // (Legacy trades or trades that were already open when the user first connected)
        if (!inPeriod && connectAt) {
          const connectTs = connectAt ? toMs(connectAt) : NaN;
          if (!Number.isFinite(connectTs)) return inPeriod;
          return openMs >= connectTs;
        }

        return inPeriod;
      })
      .map((p) => {
      const currentPrice = p.price_current ?? p.price ?? p.price_open ?? 0;
      const swapValue = p.swap ?? p.swap_amount ?? p.swapAmount ?? 0;
      return {
        isOpen: true as const,
        openTimeStr: p.server_time || p.server_time_open || (p.time_open ? String(p.time_open) : (p.open_time ? String(p.open_time) : (p.time ? String(p.time) : ""))),
        closeTimeStr: "",
        symbol: p.symbol,
        type: p.type,
        volume: p.volume,
        openPrice: p.price_open,
        closeOrCurrentPrice: currentPrice, // Real-time price
        profit: Number(p.profit), // Real-time profit
        swap: Number(swapValue || 0), // Real-time swap
      };
    });
  }, [openPositions, connectAt, runningPeriods]);

  const stats = useMemo(() => {
    const mult = Number.isFinite(lotSize) && lotSize > 0 ? lotSize : 1;
    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    const parsePercent = (val: any): number | null => {
      if (val == null) return null;
      if (typeof val === "number" && Number.isFinite(val)) return val;
      if (typeof val === "string") {
        // Support values like "30%" or "30.5".
        const m = val.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
        if (!m) return null;
        const num = Number(m[0]);
        return Number.isFinite(num) ? num : null;
      }
      return null;
    };

    // 1) Commission percent declared by admin:
    //    - Prefer explicit strategy.parameters.commission (if admin stored it there).
    //    - Otherwise use the commission percent for the user's selected plan level.
    //    - Fallback to 30%.
    const parametersCommission =
      parsePercent(strategy?.parameters?.commission ?? strategy?.parameters?.Commission);

    const planCommission =
      selectedPlan && (strategy?.planDetails as any)?.[selectedPlan]?.percent != null
        ? Number((strategy?.planDetails as any)[selectedPlan]?.percent)
        : null;

    // Commission percent is set by admin in strategy parameters (or plan details) and displayed on user side.
    const commissionPercent =
      parametersCommission != null
        ? parametersCommission
        : planCommission != null
        ? planCommission
        : 0;

    // 2) Deposits = user payments or running strategy capital (avoid double-counting where they match).
    const userId = sessionUserId;
    const successfulStatuses = new Set([
      'approved',
      'completed',
      'renewal_approved',
      'in-process',
      'paid',
      'settled',
    ]);

    // We check both the running_strategy ID and the actual strategy ID.
    const strategyIdForFilter = String(strategy?.id || params.id || '');
    const runningStrategyIdForFilter = String(rsId || params.id || '');

    const paymentDeposit = (payments as any[])
      .filter((p) => {
        const txType = String(p.transaction_type || p.type || p.transactionType || 'deposit').toLowerCase();
        if (!['deposit', 'charge', 'transfer', 'payment', 'topup', 'settled'].includes(txType)) return false;

        const paymentStrategyId = String(
          p.strategyId || p.strategy_id || p.runningStrategyId || p.running_strategy_id || p.strategy_id || p.runningStrategyId || ''
        ).trim();

        const isStrategyMatch =
          paymentStrategyId === strategyIdForFilter ||
          paymentStrategyId === runningStrategyIdForFilter ||
          paymentStrategyId === String(params.id) ||
          paymentStrategyId === String(strategy?.id) ||
          paymentStrategyId === String(rsId);

        if (!isStrategyMatch) return false;

        if (userId && String(p.userId || p.user_id) !== String(userId)) return false;

        const status = String(p.status || '').toLowerCase();
        if (!successfulStatuses.has(status) && !status.includes('settled')) return false;

        return true;
      })
      .reduce((sum, p) => sum + (Number(p.capital || p.payable || p.amount || p.payable_amount || 0)), 0);

    // Prefer the non-zero value to prevent double-counting a single funding source.
    const deposit = Math.max(0, Number(runningCapital || 0), paymentDeposit);

    // 3) Calculate totals for all closed trades from MT5 (close history tab)
    let currentCloseProfit = 0;
    let currentCloseSwap = 0;

    filteredClosed.forEach((row: any) => {
      currentCloseProfit += (Number(row.profit) || 0) * mult;
      currentCloseSwap += (Number(row.swap) || 0) * mult;
    });

    // 4) Calculate settlement totals (if any) for closed profit, swap, commission and withdrawal.
    const settlementTotals = settlements.reduce(
      (acc: { profit: number; swap: number; commission: number; withdrawal: number }, row: any) => {
        const grossProfit = Number(row.gross_profit ?? row.profit ?? 0);
        const swapAmount = Number(row.swap_amount ?? row.swap ?? 0);
        const commissionAmount = Number(row.commission_amount ?? row.commission ?? 0);
        const withdrawalAmount = Number(row.withdrawal_amount ?? row.withdrawal ?? 0);
        return {
          profit: acc.profit + (Number.isFinite(grossProfit) ? grossProfit : 0),
          swap: acc.swap + (Number.isFinite(swapAmount) ? swapAmount : 0),
          commission: acc.commission + (Number.isFinite(commissionAmount) ? commissionAmount : 0),
          withdrawal: acc.withdrawal + (Number.isFinite(withdrawalAmount) ? withdrawalAmount : 0),
        };
      },
      { profit: 0, swap: 0, commission: 0, withdrawal: 0 }
    );

    const hasSettlement =
      settlementTotals.profit !== 0 ||
      settlementTotals.swap !== 0 ||
      settlementTotals.commission !== 0 ||
      settlementTotals.withdrawal !== 0;

    // 5) Calculate current totals from open positions
    let currentOpenProfit = 0;
    let currentOpenSwap = 0;

    filteredOpen.forEach((row: any) => {
      currentOpenProfit += (Number(row.profit) || 0) * mult;
      currentOpenSwap += (Number(row.swap) || 0) * mult;
    });

    // 6) Current floating values
    const currentOpenProfitWithSwap = currentOpenProfit + currentOpenSwap;
    const currentFloatPL = currentOpenProfitWithSwap;

    // Standard forex equity (approx): unrealized P/L plus swap (or minus if negative)
    // In this context, we can report it as (Total FP/L - Total swap) if needed.
    const currentOpenEquity = currentOpenProfit - currentOpenSwap;

    // 7) Monthly settlement eligibility:
    //    - At least 30 days since connection
    //    - No open trades at the moment
    //    - Profit MUST be positive for settlement to happen
    let eligibleForSettlement = false;
    const connectedMs = connectAt ? toMs(connectAt) : NaN;
    if (Number.isFinite(connectedMs)) {
      eligibleForSettlement =
        now - connectedMs >= THIRTY_DAYS_MS && 
        filteredOpen.length === 0 &&
        currentCloseProfit > 0;
    }

    // 7) Commission & withdrawal rules for the CURRENT cycle:
    // - Before any settlement, balance = Deposit + Profit + Swap.
    // - Withdrawal card shows only SETTLED withdrawals (as requested).
    // - Profit card shows total profit (Settled + Unsettled).
    
    // 7) Commission & withdrawal rules for the CURRENT cycle:
    // - Before any settlement, balance = Deposit + Profit + Swap.
    // - Withdrawal card shows only SETTLED withdrawals (as requested).
    // - Profit card shows total profit (Settled + Unsettled).
    
    const displayProfit = Number(settlementTotals.profit || 0) + Number(currentCloseProfit || 0);
    const displaySwap = Number(settlementTotals.swap || 0) + Number(currentCloseSwap || 0);
    const displayCommission = Number(settlementTotals.commission || 0);
    // Withdrawal can never be negative, and it should only show positive withdrawals as payouts.
    const displayWithdrawal = Math.max(0, Number(settlementTotals.withdrawal || 0)); 
    const displayClosedProfitWithSwap = displayProfit + displaySwap;

    // Balance formula: Deposit + Profit + Swap - Commission
    // If profit is negative, commission is 0. If profit is positive, commission is deducted.
    const currentBalance = Number(deposit || 0) + displayProfit + displaySwap - displayCommission;
    const currentEquity = currentBalance + currentFloatPL;

    // 10) Generate Balance Operations
    const balanceOperations = (() => {
      const ops: Array<{ type: 'DEPOSIT' | 'WITHDRAWAL' | 'COMMISSION' | 'SWAP'; amount: number; time?: string; comment: string }> = [];
      
      // 1. Deposits (from payments linked to THIS running_strategy only)
      (payments as any[])
        .filter(p => {
          // CRITICAL: STRICT filtering - Only include payments explicitly linked to CURRENT running_strategy_id
          // This prevents old payments from before a stop+repurchase from appearing
          const paymentRunningStrategyId = String(p.runningStrategyId || p.running_strategy_id || '').trim();
          const thisRunningStrategyId = String(rsId || '').trim();
          
          // MUST match the current running_strategy_id - no fallback for legacy data
          // This ensures old transactions from stop+repurchase cycles don't leak through
          const matchesRunningStrategy = (
            paymentRunningStrategyId && 
            thisRunningStrategyId && 
            paymentRunningStrategyId === thisRunningStrategyId
          );
          
          return (
            matchesRunningStrategy &&
            (successfulStatuses.has(String(p.status || '').toLowerCase()) || String(p.status || '').toLowerCase().includes('settled'))
          );
        })
        .forEach(p => {
          ops.push({
            type: 'DEPOSIT',
            amount: Number(p.capital || p.payable || p.amount || p.payable_amount || 0),
            time: p.createdAt || p.created_at,
            comment: 'Initial Investment'
          });
        });

      // Append settlement operations if settlements exist.
      if (hasSettlement) {
        settlements.forEach(s => {
          const wAmt = Number(s.withdrawal_amount ?? s.withdrawalAmount ?? 0);
          const cAmt = Number(s.commission_amount ?? s.commissionAmount ?? 0);
          const sAmt = Number(s.swap_amount ?? s.swapAmount ?? 0);
          const time = s.createdAt || s.updated_at || s.created_at || s.settlement_end || s.settlementEnd || new Date().toISOString();
          
          if (cAmt !== 0) {
            ops.push({
              type: 'COMMISSION',
              amount: cAmt,
              time,
              comment: 'Settled commission amount'
            });
          }

          if (wAmt !== 0) {
            ops.push({
              type: 'WITHDRAWAL',
              amount: Math.max(0, wAmt), // Ensure withdrawal in list is also positive
              time,
              comment: 'Settled withdrawal amount'
            });
          }

          if (sAmt !== 0) {
            ops.push({
              type: 'SWAP',
              amount: sAmt,
              time,
              comment: 'Settled swap adjustment'
            });
          }
        });
      }

      // Ensure deposit is always shown if there is an investment amount
      const hasDepositOp = ops.some((o) => o.type === 'DEPOSIT');
      if (!hasDepositOp && Number(deposit) > 0) {
        ops.push({
          type: 'DEPOSIT',
          amount: Number(deposit),
          time: settlements[0]?.createdAt || new Date().toISOString(),
          comment: 'Initial deposit (fallback)'
        });
      }

      return ops.sort((a, b) => toMs(b.time) - toMs(a.time));
    })();

    return {
      deposit: Number(deposit).toFixed(2),
      withdrawal: displayWithdrawal.toFixed(2),
      profitLastMonth: displayProfit.toFixed(2),
      closedProfitWithSwap: displayClosedProfitWithSwap.toFixed(2),
      openProfitWithSwap: currentOpenProfitWithSwap.toFixed(2),
      swap: displaySwap.toFixed(2),
      openSwap: currentOpenSwap.toFixed(2),
      commission: displayCommission.toFixed(2),
      balance: currentBalance.toFixed(2),
      equity: currentEquity.toFixed(2),
      settlementEligible: eligibleForSettlement,
      floatPL: currentFloatPL.toFixed(2),
      openProfit: currentOpenProfit.toFixed(2),
      openEquity: currentOpenEquity.toFixed(2),
      balanceOperations,
      commissionPercent,
      swapBooked: currentOpenSwap
    };
  }, [
    filteredClosed,
    filteredOpen,
    lotSize,
    payments,
    params.id,
    sessionUserId,
    strategy,
    connectAt,
    selectedPlan,
    settlements,
    rsId,
    runningCapital
  ]);

  const displayRows = useMemo(() => {
    const closedRows = [...filteredClosed];
    
    if (filter === "opened") return filteredOpen;
    if (filter === "closed") return closedRows.sort((a, b) => {
      const ta = toMs(a.closeTimeStr) || 0;
      const tb = toMs(b.closeTimeStr) || 0;
      return sortOrder === "desc" ? tb - ta : ta - tb;
    });
    // For 'balance' tab, return balance operations
    if (filter === "balance") return stats.balanceOperations;
    
    return [];
  }, [filter, filteredOpen, filteredClosed, sortOrder, stats.balanceOperations]);

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
              <button
                onClick={requestStopCopying}
                disabled={isStopRequesting || strategyStatus.label === 'In-Process'}
                className={`flex items-center gap-2 text-xs font-bold uppercase tracking-tight transition-opacity ${isStopRequesting || strategyStatus.label === 'In-Process' ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:opacity-80'}`}
              >
                <FiXCircle className="w-4 h-4" />
                {isStopRequesting ? 'Submitting…' : strategyStatus.label === 'In-Process' ? 'In-Process' : 'Stop Copying'}
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
                  strategyStatus.isActive
                    ? "bg-[#00d09c] text-white"
                    : "bg-red-500 text-white"
                }`}>
                  {strategyStatus.label}
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
                <p className="text-lg font-black text-gray-900">
                  {stats.commissionPercent.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* History Container */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6">History</h2>
            {(historyError || historyInfo || usingCachedData || realtimeFetchFailed) && (
              <div className="mb-4 rounded-lg border p-3 text-xs"
                   style={{
                     borderColor: historyError ? '#f59e0b' : '#93c5fd',
                     color: historyError ? '#b45309' : '#1e3a8a',
                     backgroundColor: historyError ? '#fef3c7' : '#bfdbfe',
                   }}
              >
                {historyError
                  ? historyError
                  : realtimeFetchFailed
                  ? 'Real-time data is unavailable. Showing cached closed history; open positions are paused until live connection restores.'
                  : usingCachedData
                  ? 'Using cached history data while live data is unavailable.'
                  : historyInfo}
              </div>
            )}
            
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
                <p className="text-2xl font-black text-gray-900">${stats.deposit}</p>
                <p className="text-xs font-bold text-gray-400 uppercase mt-1">Deposit</p>
              </div>
              <div className="px-4 border-r border-gray-100 last:border-0">
                <p className="text-2xl font-black text-gray-900">
                  ${stats.withdrawal}
                </p>
                <p className="text-xs font-bold text-gray-400 uppercase mt-1">Withdrawal</p>
              </div>
              <div className="px-4 border-r border-gray-100 last:border-0">
                <p
                  className={`text-2xl font-black ${
                    Number(stats.closedProfitWithSwap) >= 0 ? 'text-gray-900' : 'text-red-500'
                  }`}
                >
                  ${stats.closedProfitWithSwap}
                </p>
                <p className="text-xs font-bold text-gray-400 uppercase mt-1">Profit</p>
              </div>
              <div className="px-4 border-r border-gray-100 last:border-0">
                <p className="text-2xl font-black text-gray-900">${filter === 'closed' ? stats.swap : stats.openSwap}</p>
                <p className="text-xs font-bold text-gray-400 uppercase mt-1">Swap</p>
              </div>
              <div className="px-4 border-r border-gray-100 last:border-0">
                {filter === 'opened' ? (
                  <>
                    <p className="text-2xl font-black text-gray-900">${stats.equity}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase mt-1">Equity</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-black text-gray-900">${stats.commission}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase mt-1">Commission</p>
                  </>
                )}
              </div>
              <div className="px-4 border-r border-gray-100 last:border-0">
                <p className="text-2xl font-black text-gray-900">
                  ${filter === 'opened' ? stats.floatPL : stats.balance}
                </p>
                <p className="text-xs font-bold text-gray-400 uppercase mt-1">
                  {filter === 'opened'
                    ? 'Float P/L'
                    : filter === 'balance'
                      ? stats.settlementEligible
                        ? 'Settled Balance'
                        : 'Locked Balance'
                      : 'Balance'}
                </p>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-gray-400 uppercase border-b border-gray-50">
                    {filter === 'balance' ? (
                      <>
                        <th className="px-6 py-4">Operation Type</th>
                        <th className="px-6 py-4">Time, UTC</th>
                        <th className="px-6 py-4">Comment</th>
                        <th className="px-6 py-4 text-right">Amount, USD</th>
                      </>
                    ) : (
                      <>
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
                        <th className="px-6 py-4 text-right">{filter === 'opened' ? 'Current price' : 'Closing price'}</th>
                        <th className="px-6 py-4 text-right">Swap, USD</th>
                        <th className="px-6 py-4 text-right">Profit, USD</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                {paginatedRows.length > 0 ? (
                  paginatedRows.map((row: any, idx: number) => {
                    if (filter === 'balance') {
                      return (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-6 py-5">
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border ${
                              row.type === 'DEPOSIT' ? 'text-green-500 border-green-100 bg-green-50/30' :
                              row.type === 'WITHDRAWAL' ? 'text-blue-500 border-blue-100 bg-blue-50/30' :
                              row.type === 'COMMISSION' ? 'text-purple-500 border-purple-100 bg-purple-50/30' :
                              'text-red-500 border-red-100 bg-red-50/30'
                            }`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-xs font-bold text-gray-500">
                            {formatDateShort(row.time)}
                          </td>
                          <td className="px-6 py-5 text-xs font-bold text-gray-700">
                            {row.comment}
                          </td>
                          <td className={`px-6 py-5 text-xs font-black text-right ${
                            row.type === 'DEPOSIT' || (row.type === 'WITHDRAWAL' && (row.amount || 0) >= 0) ? 'text-[#00d09c]' : 'text-red-500'
                          }`}>
                            {(row.amount || 0) >= 0 ? '+' : ''}{(Number(row.amount) || 0).toFixed(2)}
                          </td>
                        </tr>
                      );
                    }

                    const pos = row;
                    const isBuy = String(pos.type).toUpperCase().includes('BUY') || pos.type === 0 || pos.type === "0";
                    const mult = Number.isFinite(lotSize) && lotSize > 0 ? lotSize : 1;
                    const vol = (Number(pos.volume) || 0) * mult;
                    const profitVal = (Number(pos.profit) || 0) * mult;
                    const swapVal = (Number(pos.swap) || 0) * mult;
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
                        <td className="px-6 py-5 text-xs font-bold text-right">
                          {swapVal.toFixed(2)}
                        </td>
                        <td className={`px-6 py-5 text-xs font-bold text-right ${profitVal >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {profitVal >= 0 ? "" : "-"}{Math.abs(profitVal).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={filter === 'closed' ? 9 : 8} className="px-6 py-20 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                      No orders found
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
