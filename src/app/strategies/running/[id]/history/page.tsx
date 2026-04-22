
"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import UserLayout from "@/components/UserLayout";
import { COUNTRY_OPTIONS } from '@/utils/countries';
import { FiChevronLeft, FiChevronRight, FiPlusCircle, FiMinusCircle, FiXCircle, FiExternalLink, FiChevronDown, FiActivity, FiClock, FiDollarSign, FiBarChart2, FiArrowUpRight, FiArrowDownLeft, FiUser, FiAlertCircle } from "react-icons/fi";

// ...existing code...

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
  parameters: Record<string, any>;
  planDetails?: Record<string, any>;
};

type Payment = {
  userId?: string;
  strategyId?: string;
  lotSize?: number;
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
  capital?: number;
  transaction_type?: string;
  transactionType?: string;
  admin_message?: string;
};

type BalanceOp = {
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'COMMISSION' | 'SWAP';
  amount: number;
  time: string;
  comment: string;
};

type Plan = "Pro" | "Expert" | "Premium";
const LOT_SIZE_USER_OVERRIDES: Record<string, number> = {};

const extractLotFromAdminMessage = (msg: any): number => {
  const s = String(msg ?? '').toLowerCase();
  if (!s) return 0;
  const m1 = s.match(/(?:equal\s*x|x|lot\s*[:=])\s*(\d+(?:\.\d+)?)/i);
  if (m1) {
    const n = Number(m1[1]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return 0;
};

const parseLotPricingRows = (lotPricing: any): Array<{ lot: number; amountUSD: number }> => {
  try {
    if (!lotPricing) return [];
    const parsed = typeof lotPricing === 'string' ? JSON.parse(lotPricing) : lotPricing;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => ({ lot: Number(x?.lot), amountUSD: Number(x?.amountUSD) }))
      .filter((x: any) => Number.isFinite(x.lot) && x.lot > 0 && Number.isFinite(x.amountUSD) && x.amountUSD > 0)
      .sort((a, b) => a.amountUSD - b.amountUSD);
  } catch {
    return [];
  }
};

const deriveLotFromPricingTiers = (capital: number, lotPricing: any, fallbackUnitPrice: number): number => {
  const cap = Number(capital || 0);
  if (!Number.isFinite(cap) || cap <= 0) return 1;
  const rows = parseLotPricingRows(lotPricing);
  // If pricing is missing/invalid, fallback to per-strategy unit price.
  if (rows.length === 0) return Math.max(1, Math.floor(cap / Math.max(1, fallbackUnitPrice)));
  const one = rows.find((x) => Number(x.lot) === 1);
  if (one && Number.isFinite(one.amountUSD) && one.amountUSD > 0) {
    const derived = Math.floor(cap / Number(one.amountUSD));
    const lot = Math.max(1, derived);
    // IMPORTANT: do not clamp to preset tiers; lot can exceed examples in lotPricing.
    return lot;
  }
  let best = rows[0];
  for (const r of rows) {
    if (r.amountUSD <= cap) best = r;
    else break;
  }
  return Number.isFinite(best?.lot) && best.lot > 0 ? best.lot : 1;
};

const toTradeSide = (row: any): 'BUY' | 'SELL' => {
  const rawCandidates = [
    row?.type,
    row?.side,
    row?.action,
    row?.order_type,
    row?.position_type,
    row?.cmd,
  ].map((v) => String(v ?? '').toUpperCase().trim());

  if (rawCandidates.some((v) => v === '1' || v === 'SELL' || v.includes('SELL'))) return 'SELL';
  if (rawCandidates.some((v) => v === '0' || v === 'BUY' || v.includes('BUY'))) return 'BUY';
  return 'BUY';
};

const toDisplaySymbol = (value: any): string => {
  const raw = String(value ?? 'UNKNOWN').trim().toUpperCase();
  if (!raw || raw === 'UNKNOWN') return 'UNKNOWN';

  // Remove common broker suffixes (e.g. BTCUSDm, EURUSD.pro, XAUUSD.a)
  const cleaned = raw
    .replace(/[._-].*$/, '')
    .replace(/(MICRO|MINI|PRO|ECN)$/i, '')
    .replace(/[A-Z]{0,2}M$/i, (m) => (m.toUpperCase() === 'M' ? '' : m));

  const knownQuotes = ['USD', 'USDT', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'BTC', 'ETH'];
  for (const quote of knownQuotes) {
    if (cleaned.length > quote.length && cleaned.endsWith(quote)) {
      const base = cleaned.slice(0, cleaned.length - quote.length);
      if (base.length >= 2 && base.length <= 6) return `${base}/${quote}`;
    }
  }
  return cleaned;
};

const parsePaymentMs = (p: any, toMs: (v: any) => number): number => {
  return toMs(p?.createdAt ?? p?.created_at ?? p?.time ?? p?.created_at);
};

const parseUnitPrice = (strategy: any): number => {
  // Prefer lotPricing 1-lot price; fallback to smallest amountUSD/lot; last resort 1000.
  try {
    const lp = strategy?.parameters?.lotPricing;
    const rows = parseLotPricingRows(lp);
    const one = rows.find((r) => Number(r.lot) === 1);
    if (one && Number.isFinite(one.amountUSD) && one.amountUSD > 0) return Number(one.amountUSD);
    if (rows.length > 0) {
      const unit = Number(rows[0].amountUSD) / Number(rows[0].lot || 1);
      if (Number.isFinite(unit) && unit > 0) return unit;
    }
  } catch {}
  const minCap = Number(strategy?.parameters?.minCapital ?? strategy?.parameters?.min_capital ?? 1000);
  return Number.isFinite(minCap) && minCap > 0 ? minCap : 1000;
};

const buildLotTimeline = (payments: any[], toMs: (v: any) => number, unitPrice: number) => {
  const events = payments
    .map((p) => {
      const t = parsePaymentMs(p, toMs);
      const type = String(p?.transaction_type || p?.transactionType || '').toLowerCase();
      const status = String(p?.status || '').toLowerCase();
      const msg = String(p?.admin_message || p?.adminMessage || '').toLowerCase();
      const ok = status === 'completed' || status === 'approved' || status === 'settled';
      if (!ok) return null;

      const rawAmount = Number(p?.capital ?? p?.amount ?? p?.payable ?? 0);
      if (!Number.isFinite(rawAmount) || rawAmount <= 0) return null;

      // Capital movements only:
      // - Increase: charge or deposit
      // - Reduction: settled or withdrawal + "investment reduction" message
      const isReduction = (type === 'settled' || type === 'withdrawal') && msg.includes('investment reduction');
      const isIncrease = type === 'charge' || type === 'deposit';
      if (!isIncrease && !isReduction) return null;

      const delta = isReduction ? -rawAmount : rawAmount;
      // Capture the lot size recorded in the transaction if available
      const pLot = Number(p?.lotSize ?? p?.lot_size ?? 0);
      const msgLot = extractLotFromAdminMessage(msg);
      const recordedLot = pLot > 0 ? pLot : msgLot;

      return { ms: t, delta, action: isReduction ? 'reduce' : 'add', recordedLot };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.ms - b.ms);

  let cumulative = 0;
  const timeline: Array<{ ms: number; lot: number; action: string }> = [];
  for (const e of events as any[]) {
    if (!Number.isFinite(e.ms) || e.ms <= 0) continue;
    cumulative += Number(e.delta || 0);
    
    // If we have a recorded lot size from the transaction, use it.
    // Otherwise, recalculate based on the cumulative capital and unit price.
    let lot = e.recordedLot > 0 ? e.recordedLot : Math.max(1, Math.floor(cumulative / Math.max(1, unitPrice)));
    
    timeline.push({ ms: e.ms, lot, action: e.action });
  }
  return timeline;
};

  const getLotForTime = (ms: number, timeline: Array<{ ms: number; lot: number; action: string }>, fallbackLot: number, isOpenTrade: boolean = false): number => {
    if (!timeline || timeline.length === 0) return fallbackLot;
    
    // Sort timeline DESCENDING to find the most recent state
    const sorted = [...timeline].sort((a, b) => b.ms - a.ms);
    
    // SAFETY BUFFER LOGIC:
    // 1. Reductions: Apply strictly (30s buffer) to capture immediate trades.
    // 2. Increases: Use a 10-minute "Penalty Buffer". An investment increase 
    //    won't be used unless the trade opened at least 10 mins AFTER the deposit.
    //    This handles the "Short Gap" issue where trades pick up new lots too early.
    const INCREASE_PENALTY_MS = 10 * 60 * 1000;
    const REDUCTION_BUFFER_MS = 30 * 1000;
    
    for (const r of sorted) {
      const isIncrease = r.action === 'add' || r.action === 'initial';
      const effectiveEventMs = isIncrease ? (r.ms + INCREASE_PENALTY_MS) : (r.ms - REDUCTION_BUFFER_MS);

      if (ms >= effectiveEventMs) {
        return r.lot;
      }
    }
    
    // If trade is older than any recorded event (even with buffers), 
    // return the oldest known state.
    const oldest = [...timeline].sort((a, b) => a.ms - b.ms)[0];
    return oldest ? oldest.lot : (fallbackLot || 1);
  };

export default function CopierHistoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [realStrategyId, setRealStrategyId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [openPositions, setOpenPositions] = useState<OpenItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [investmentTimeline, setInvestmentTimeline] = useState<Array<{ event_ms: number; lot_size: number; total_capital: number }>>([]);
  const [investmentTimelineUnitPrice, setInvestmentTimelineUnitPrice] = useState<number | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyInfo, setHistoryInfo] = useState<string | null>(null);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [realtimeFetchFailed, setRealtimeFetchFailed] = useState(false);
  const [historyUpdatedAt, setHistoryUpdatedAt] = useState<string | null>(null);
  const [connectAt, setConnectAt] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [tradeLots, setTradeLots] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<"opened" | "closed" | "balance">("closed");
  const [historyPage, setHistoryPage] = useState(1);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [mtStatus, setMtStatus] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [rsId, setRsId] = useState<string | null>(null);
  const [runningLotSize, setRunningLotSize] = useState<number | null>(null);
  const [runningPeriods, setRunningPeriods] = useState<any[]>([]);
  const [modifications, setModifications] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [runningCapital, setRunningCapital] = useState<number>(0);
  const [isStopRequesting, setIsStopRequesting] = useState<boolean>(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  
  const [investmentModal, setInvestmentModal] = useState<{ open: boolean; action: 'add' | 'reduce' | null }>({ open: false, action: null });
  const [investmentAmount, setInvestmentAmount] = useState<string>('');
  const [investmentBusy, setInvestmentBusy] = useState<boolean>(false);
  const [investmentError, setInvestmentError] = useState<string | null>(null);

  const strategyStatus = useMemo(() => {
    const rawAdmin = String(adminStatus || "").toLowerCase();
    const rawMt = String(mtStatus || "").toLowerCase();
    
    if (rawAdmin.includes("running") || rawAdmin.includes("copying") || rawAdmin.includes("active") || 
        rawMt.includes("running") || rawMt.includes("active")) {
      return { label: "Running/Copying", isActive: true };
    }
    
    if (rawAdmin.includes("in-process") || rawAdmin.includes("in process")) {
      return { label: "In-Process", isActive: false };
    }
    
    if (rawAdmin.includes("stopped") || rawAdmin.includes("idle") || rawAdmin.includes("offline") || rawAdmin.includes("disconnected") ||
        rawMt.includes("stopped") || rawMt.includes("disconnected")) {
      return { label: "Stopped", isActive: false };
    }
    
    return { label: "Stopped", isActive: false };
  }, [adminStatus, mtStatus]);

  const toMs = (v: string | number | null | undefined): number => {
    if (v == null || v === "") return NaN;
    if (typeof v === "string") {
      // First, check if it's a standard ISO string or similar that Date.parse can handle directly
      if (v.includes('T') || v.includes('Z')) {
        const t = Date.parse(v);
        if (Number.isFinite(t)) return t;
      }

      // Second, try to match the common MT5 format "YYYY.MM.DD HH:mm:ss"
      const m = v.match(/^(\d{4})[\.\-/](\d{2})[\.\-/](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
      if (m) {
        const [_, yy, MM, dd, hh, mm, ss] = m;
        // Force UTC to ensure comparison with database timestamps (which are UTC) is consistent
        return Date.UTC(Number(yy), Number(MM) - 1, Number(dd), Number(hh), Number(mm), Number(ss));
      }

      // Third, try the MT5 format without year "13 Apr 17:58:47"
      const m2 = v.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2}):(\d{2}):(\d{2})/);
      if (m2) {
        const day = Number(m2[1]);
        const mon = m2[2].toLowerCase();
        const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        const monthIdx = months[mon];
        if (monthIdx !== undefined) {
          const now = new Date();
          // We assume it's the current year if not specified
          return Date.UTC(now.getFullYear(), monthIdx, day, Number(m2[3]), Number(m2[4]), Number(m2[5]));
        }
      }

      let t = Date.parse(v);
      if (!Number.isFinite(t)) {
        // Try replacing dots with dashes for some MT5 formats
        t = Date.parse(v.replace(/\./g, '-'));
      }
      return Number.isFinite(t) ? t : NaN;
    }
    const num = Number(v);
    if (!Number.isFinite(num)) return NaN;
    return num < 10000000000 ? num * 1000 : num;
  };

  const selectedLotSize = useMemo(() => {
    const cap = Number(runningCapital || 0);
    const minCap = Number(
      (strategy as any)?.minCapital ??
      (strategy as any)?.min_capital ??
      (strategy as any)?.parameters?.minCapital ??
      (strategy as any)?.parameters?.min_capital ??
      1000
    );
    const lotPricing = strategy?.parameters?.lotPricing;
    return deriveLotFromPricingTiers(cap, lotPricing, Number.isFinite(minCap) && minCap > 0 ? minCap : 1000);
  }, [strategy, payments, params.id, rsId, runningLotSize, sessionUserId, runningCapital]);

  // --- Unified Lot Timeline Logic ---
  const unifiedLotTimeline = useMemo(() => {
    const normalizeId = (v: any) => String(v ?? '').trim();
    const sId = normalizeId(realStrategyId);
    const pId = normalizeId(params.id);
    const rs_Id = normalizeId(rsId);

    const strategyPayments = payments.filter((p: any) => {
      const pStrategyId = normalizeId((p as any).strategyId ?? (p as any).strategy_id);
      const pRsId = normalizeId((p as any).runningStrategyId ?? (p as any).running_strategy_id);
      const matchStrategy = pStrategyId && (pStrategyId === sId || pStrategyId === pId);
      const matchRs = pRsId && (pRsId === rs_Id || pRsId === pId);
      return matchStrategy || matchRs;
    });

    const unitPrice = (investmentTimelineUnitPrice && investmentTimelineUnitPrice > 0) ? investmentTimelineUnitPrice : parseUnitPrice(strategy);
    
    // We combine the server-side timeline with the local payments state for maximum real-time accuracy.
    const localTimeline = buildLotTimeline(strategyPayments, toMs, unitPrice);
    const serverTimeline = (investmentTimeline || [])
      .filter((e: any) => Number.isFinite(Number(e.event_ms)) && Number.isFinite(Number(e.lot_size)))
      .map((e: any) => ({ ms: Number(e.event_ms), lot: Number(e.lot_size), action: String(e.action || 'add') }));

    // Merge and sort
    const merged = [...localTimeline];
    for (const s of serverTimeline) {
      if (!merged.find(m => Math.abs(m.ms - s.ms) < 5000)) { // 5s deduplication
        merged.push(s);
      }
    }
    return merged.sort((a, b) => a.ms - b.ms);
  }, [payments, params.id, rsId, realStrategyId, strategy, investmentTimeline, investmentTimelineUnitPrice]);

  const loadHistory = useCallback(async () => {
    if (!params.id) return;
    try {
      const uId = sessionUserId || "";
      const [hRes, runRes, payRes, timelineRes] = await Promise.all([
        fetch(`/api/strategies/${params.id}/master-history?userId=${encodeURIComponent(uId)}&t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/strategies/running`, { cache: "no-store" }),
        fetch(`/api/payments`, { cache: "no-store" }),
        rsId ? fetch(`/api/strategies/running/${rsId}/investment-timeline`, { cache: "no-store" }).catch(() => null) : Promise.resolve(null)
      ]);

      if (!hRes.ok) {
        setHistoryError(`Failed to load history: ${hRes.statusText}`);
        setHistoryLoading(false);
        return;
      }

      const data = await hRes.json();
      if (!data.cached) {
        setRealtimeFetchFailed(false);
      } else {
        setRealtimeFetchFailed(true);
      }
      
      setOpenPositions(data.open_positions || []);
      setHistory(data.history || []);
      if (data.trade_lots) {
        setTradeLots(data.trade_lots);
      }
      
      const payJson = await payRes.json().catch(() => null);
      if (payJson?.payments) {
        setPayments(payJson.payments);
      }

      if (timelineRes && timelineRes.ok) {
        const timelineData = await timelineRes.json().catch(() => null);
        if (timelineData?.timeline) {
          setInvestmentTimeline(timelineData.timeline);
          if (timelineData.unitPrice) setInvestmentTimelineUnitPrice(timelineData.unitPrice);
        }
      }

      setHistoryInfo(data.info || null);
      setHistoryUpdatedAt(data.last_updated || null);
      if (typeof window !== "undefined") {
        try {
          const key = `copier_history_cache_${params.id}`;
          window.localStorage.setItem(key, JSON.stringify({
            history: data.history || [],
            open_positions: data.open_positions || [],
            saved_at: Date.now(),
          }));
        } catch { }
      }
      setHistoryError(data.error || null);
      setUsingCachedData(Boolean(data.cached));
      const runData = await runRes.json().catch(() => null);
      if (runRes.ok && runData) {
        const strategiesList = Array.isArray(runData?.strategies) ? runData.strategies : (Array.isArray(runData) ? runData : []);
        const me = strategiesList.find((x: any) => (x.id === params.id || x.rsId === params.id || x.strategyId === params.id));

        if (me) {
          setAdminStatus(me.adminStatus || me.admin_status || null);
          setMtStatus(me.status || null);
          setSelectedPlan((me.plan as Plan | undefined) ?? null);
          const connectedAt = me.createdAt || me.created_at || null;
          setConnectAt(connectedAt);
          setUpdatedAt(me.updatedAt || me.updated_at || null);
          setRsId(me.rsId || me.id || null);
          setRunningLotSize(Number(me.lotSize || me.lot_size || 0));
          setRunningPeriods(me.periods || []);
          setModifications(me.modifications || []);
          setSnapshots(me.snapshots || []);
          setRunningCapital(Number(me.capital || 0));

          // Hardcore fix: use a server-derived investment timeline (epoch ms) to avoid timezone parsing issues.
          try {
            const tlRes = await fetch(`/api/strategies/running/${me.rsId || me.id}/investment-timeline?t=${Date.now()}`, { cache: "no-store" });
            const tlJson = await tlRes.json().catch(() => null);
            if (tlRes.ok && tlJson?.success) {
              setInvestmentTimeline(Array.isArray(tlJson.timeline) ? tlJson.timeline : []);
              setInvestmentTimelineUnitPrice(Number(tlJson.unitPrice) || null);
            }
          } catch {
            // Keep existing timeline if fetch fails
          }

          if (me.rsId || me.id) {
            try {
              const sRes = await fetch(`/api/strategies/running/${me.rsId || me.id}/settlements`);
              if (sRes.ok) {
                const sData = await sRes.json();
                const settlementsData = Array.isArray(sData.settlements) ? sData.settlements : [];
                settlementsData.sort((a: any, b: any) => {
                  const aEnd = toMs(a.settlementEnd || a.settlement_end || a.settlementEnd || 0);
                  const bEnd = toMs(b.settlementEnd || b.settlement_end || b.settlementEnd || 0);
                  if (aEnd !== bEnd) return bEnd - aEnd;
                  const aCreated = toMs(a.createdAt || a.created_at || a.settlement_created_at || 0);
                  const bCreated = toMs(b.createdAt || b.created_at || b.settlement_created_at || 0);
                  return bCreated - aCreated;
                });
                setSettlements(settlementsData);
              }
            } catch (err) {
              console.error('Error fetching settlements:', err);
            }
          }
        }
      }
    } catch (e: any) {
      console.error("Failed to load history data:", e);
      setHistoryError(e?.message || "Failed to load history data.");
    } finally {
      setHistoryLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    const load = async () => {
      const [stratRes, paymentsRes, profileRes] = await Promise.all([
        fetch("/api/strategies", { cache: "no-store" }),
        fetch("/api/payments", { cache: "no-store" }),
        fetch("/api/profile", { cache: "no-store" }).catch(() => null),
      ]);
      const stratData = await stratRes.json();
      const s = (stratData.strategies || []).find((x: any) => (x.id === params.id || x.strategyId === params.id));
      setStrategy(s || null);
      if (s) setRealStrategyId(s.id);
      const payJson = await paymentsRes.json();
      setPayments(payJson.payments || []);

      if (profileRes && profileRes.ok) {
        const profileData = await profileRes.json().catch(() => null);
        if (profileData?.user) {
          setSessionUserId(profileData.user.id || null);
          setUserProfile(profileData.user);
        }
      } else if (session?.user) {
        setSessionUserId((session.user as any).id || null);
        setUserProfile(session.user);
      }
      await loadHistory();
    };
    load();
  }, [params.id, loadHistory]);

  // Polling for real-time data
  useEffect(() => {
    const interval = setInterval(() => {
      loadHistory();
    }, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [loadHistory]);

  const requestStopCopying = async () => {
    if (!rsId) return alert("Running strategy session not found.");
    if (!confirm("Are you sure you want to stop copying?")) return;
    setIsStopRequesting(true);
    try {
      const res = await fetch(`/api/running-strategies/${rsId}/modification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      if (!res.ok) throw new Error('Stop-copy request failed');
      alert("Stop request submitted. Admin will review and process.");
      setAdminStatus('in-process');
    } catch (e: any) {
      alert(`Failed: ${e.message}`);
    } finally {
      setIsStopRequesting(false);
    }
  };

  const filteredClosed = useMemo(() => {
    // If status is not running/copying, and we're just starting, don't show old trades
    // But user wants close trades to be displayed if status is running/copying.
    const isRunning = strategyStatus.isActive;

    // Custom filter for specific user "user_1772105441338" and start date April 2nd 2026
    const filterBySpecificUserDate = (effectiveMs: number) => {
      if (sessionUserId === 'user_1772105441338') {
        const platformStartDate = new Date('2026-04-02T00:00:00Z').getTime();
        return effectiveMs >= platformStartDate;
      }
      return true;
    };

    return history.filter(h => {
      const openMs = Number.isFinite(Number((h as any).time_open_ms))
        ? Number((h as any).time_open_ms)
        : toMs((h.server_time_open ?? h.time_open) ?? (h.open_time ?? h.time));
      const closeMs = Number.isFinite(Number((h as any).time_close_ms))
        ? Number((h as any).time_close_ms)
        : toMs((h.server_time_close ?? h.time_close) ?? (h.close_time ?? h.time));
      if (!Number.isFinite(openMs) && !Number.isFinite(closeMs)) return true;
      const effectiveMs = Number.isFinite(openMs) ? openMs : closeMs;

      // Apply the user-specific platform creation date filter
      if (!filterBySpecificUserDate(effectiveMs)) return false;

      if (runningPeriods.length === 0) {
        const connectTs = connectAt ? toMs(connectAt) : NaN;
        return !Number.isFinite(connectTs) || openMs >= connectTs;
      }
      return runningPeriods.some(p => {
        const start = toMs(p.start_time || p.start || p.connectedAt);
        const end = (p.end_time || p.end) ? toMs(p.end_time || p.end) : Infinity;
        return openMs >= start && openMs <= end;
      });
    }).map(h => {
      const normalizedType = toTradeSide(h);
      const normalizedSymbol = toDisplaySymbol(h.symbol ?? (h as any).Symbol ?? (h as any).instrument ?? (h as any).Instrument);
      // Apply lot based on trade CLOSE time so it matches the locked value in `tradeLots`.
      const openMs = Number.isFinite(Number((h as any).time_open_ms))
        ? Number((h as any).time_open_ms)
        : toMs((h.server_time_open ?? h.time_open) ?? (h.open_time ?? h.time));
      
      const closeMs = Number.isFinite(Number((h as any).time_close_ms))
        ? Number((h as any).time_close_ms)
        : toMs((h.server_time_close ?? h.time_close) ?? (h.close_time ?? h.time));

      const eventMs = Number.isFinite(closeMs) ? closeMs : openMs;
      
      const ticket = String((h as any).ticket || (h as any).Ticket || (h as any).id || (h as any).order || "");
      let lotMultiplier: number;
      if (ticket && tradeLots[ticket]) {
        lotMultiplier = tradeLots[ticket];
      } else {
        // If backend didn't lock this closed trade yet, fall back to close-time derived lot.
        lotMultiplier = Number.isFinite(eventMs)
          ? getLotForTime(eventMs, unifiedLotTimeline, selectedLotSize, false)
          : selectedLotSize;
      }

      return {
        isOpen: false,
        openTimeStr: String(((h.server_time_open ?? h.time_open) ?? (h.open_time ?? h.time)) || ""),
        closeTimeStr: String(((h.server_time_close ?? h.time_close) ?? (h.close_time ?? h.time)) || ""),
        symbol: normalizedSymbol,
        type: normalizedType,
        volume: Number(h.volume || 0) * lotMultiplier,
        openPrice: h.price_open,
        closeOrCurrentPrice: h.price_close,
        profit: Number(h.profit) * lotMultiplier,
        swap: Number(h.swap || 0) * lotMultiplier,
        ticket,
      };
    });
  }, [history, connectAt, runningPeriods, sessionUserId, strategyStatus.isActive, selectedLotSize, unifiedLotTimeline, tradeLots]);

  const filteredOpen = useMemo(() => {
    // If status is not running/copying, don't show open trades
    // EXCEPTION: If we are using cached data because of a connection loss, show them anyway.
    if (!strategyStatus.isActive && !usingCachedData) return [];

      // Custom filter for specific user "user_1772105441338" and start date April 2nd 2026
      const filterBySpecificUserDate = (effectiveMs: number) => {
        if (sessionUserId === 'user_1772105441338') {
          const platformStartDate = new Date('2026-04-02T00:00:00Z').getTime();
          return effectiveMs >= platformStartDate;
        }
        return true;
      };

      return openPositions.filter(p => {
      const openMs = Number.isFinite(Number((p as any).time_open_ms))
        ? Number((p as any).time_open_ms)
        : toMs((p.server_time || p.server_time_open) || (p.time_open || (p.open_time || p.time)));
      if (!Number.isFinite(openMs)) return true;

      // Apply user-specific filter
      if (!filterBySpecificUserDate(openMs)) return false;

      if (runningPeriods.length === 0) {
        const connectTs = connectAt ? toMs(connectAt) : NaN;
        return !Number.isFinite(connectTs) || openMs >= connectTs;
      }
      return runningPeriods.some(pr => {
        const start = toMs(pr.start_time || pr.start || pr.connectedAt);
        const end = (pr.end_time || pr.end) ? toMs(pr.end_time || pr.end) : Infinity;
        return openMs >= start && openMs <= end;
      });
    }).map(p => {
      const ticket = String((p as any).ticket || (p as any).Ticket || (p as any).id || (p as any).order || "");
      const mt5Lot = Number(p.volume || 0);
      // Open trades must react to investment changes while the position is still open.
      // So we compute lot based on the CURRENT effective investment timeline (not open time).
      const nowMs = Date.now();
      const lotMultiplier = Number.isFinite(nowMs)
        ? getLotForTime(nowMs, unifiedLotTimeline, selectedLotSize, true)
        : selectedLotSize;

      const calculatedLot = mt5Lot * lotMultiplier;

      const tradeType = toTradeSide(p);
      const rawSymbol = (p as any).symbol ?? (p as any).Symbol ?? (p as any).instrument ?? 'UNKNOWN';
      const normalizedSymbol = toDisplaySymbol(rawSymbol);

      return {
        isOpen: true,
        openTimeStr: String((p.server_time || p.server_time_open) || (p.time_open || (p.open_time || p.time)) || ""),
        closeTimeStr: "",
        symbol: normalizedSymbol,
        type: tradeType,
        volume: calculatedLot,
        openPrice: p.price_open,
        closeOrCurrentPrice: p.price_current ?? p.price ?? p.price_open ?? 0,
        profit: Number(p.profit) * lotMultiplier,
        swap: Number(p.swap ?? p.swap_amount ?? p.swapAmount ?? 0) * lotMultiplier,
        ticket, 
      };
    });
  }, [openPositions, connectAt, runningPeriods, sessionUserId, strategyStatus.isActive, selectedLotSize, unifiedLotTimeline, tradeLots]);

  // --- Use backendEquity if available for all equity displays ---
  const [backendEquity, setBackendEquity] = useState<number | null>(null);
  const [backendDeposit, setBackendDeposit] = useState<number | null>(null);
  const [strategyCurrency, setStrategyCurrency] = useState<string>('USD');
  const [isUSC, setIsUSC] = useState<boolean>(false);

  useEffect(() => {
    if (!rsId) return;
    let mounted = true;
    fetch(`/api/strategies/running/${rsId}/investment?t=${Date.now()}`, { method: 'GET', cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (mounted && data?.success) {
          if (typeof data.equity === 'number') setBackendEquity(data.equity);
          if (typeof data.deposit === 'number') setBackendDeposit(data.deposit);
          if (data.currency) setStrategyCurrency(data.currency);
          if (typeof data.isUSC === 'boolean') setIsUSC(data.isUSC);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [rsId]);

  const stats = useMemo(() => {
    const normalizeId = (v: any) => String(v ?? '').trim();
    const currentStrategyId = normalizeId(realStrategyId || params.id);
    const currentRsId = normalizeId(rsId);

    // 1. Total Deposit: HARDCORE RECALCULATION
    // We strictly only count "charge" (added funds) and "settled" with reduction message (removed funds).
    // We IGNORE the running_strategies.capital field if it has been corrupted by profit settlements.
    const rawPayments = payments.filter(p => {
      const pStrategyId = normalizeId((p as any).strategyId ?? (p as any).strategy_id);
      const pRsId = normalizeId((p as any).runningStrategyId ?? (p as any).running_strategy_id);
      
      const sId = normalizeId(realStrategyId);
      const pId = normalizeId(params.id);
      const rs_Id = normalizeId(rsId);

      // Match by ANY known identifier
      const matchStrategy = pStrategyId && (pStrategyId === sId || pStrategyId === pId);
      const matchRs = pRsId && (pRsId === rs_Id || pRsId === pId);
      
      return matchStrategy || matchRs;
    });

    let hardcoreDeposit = rawPayments.filter(p => {
      const type = String(p.transaction_type || p.transactionType || '').toLowerCase();
      const status = String(p.status || '').toLowerCase();
      const msg = String((p as any).admin_message || (p as any).adminMessage || '').toLowerCase();
      const isReduction = (type === 'settled' || type === 'withdrawal') && msg.includes('investment reduction');
      const isIncrease = type === 'charge' || type === 'deposit';
      return (status === 'completed' || status === 'approved' || status === 'settled') && (isIncrease || isReduction);
    }).reduce((sum, p) => {
      const type = String(p.transaction_type || p.transactionType || '').toLowerCase();
      const msg = String((p as any).admin_message || (p as any).adminMessage || '').toLowerCase();
      const val = Number(p.capital || p.amount || 0);
      const isReduction = (type === 'settled' || type === 'withdrawal') && msg.includes('investment reduction');
      return sum + (isReduction ? -val : val);
    }, 0);

    // Fallback if no payments recorded but running capital exists (likely initial state)
    if (hardcoreDeposit <= 0 && Number(runningCapital) > 0) {
      hardcoreDeposit = Number(runningCapital);
    }

    // 2. Real-time summary stats (all closed orders shown in table)
    const totalRealizedProfit = filteredClosed.reduce((sum, r) => sum + r.profit, 0);
    const totalRealizedSwap = filteredClosed.reduce((sum, r) => sum + r.swap, 0);

    // 3. Commission: Strictly 30% of profit
    const commissionPercent = 30; // Hardcoded 30% as per requirements
    const totalCommission = totalRealizedProfit > 0 ? (totalRealizedProfit * commissionPercent / 100) : 0;

    // 4. Withdrawal: Strictly (Profit - Commission)
    const totalWithdrawal = totalRealizedProfit > 0 ? (totalRealizedProfit - totalCommission) : 0;

    // 5. Locked Balance: Strictly (Deposit + Swap + Net Profit)
    // (Used as "Locked Balance"/balance card on the closed-orders view.)
    const calculatedLockedBalance = hardcoreDeposit + totalRealizedSwap + totalWithdrawal;

    // 6. FP/L and Equity
    const currentFloatProfitOnly = filteredOpen.reduce((sum, r) => sum + r.profit, 0);
    const currentOpenSwap = filteredOpen.reduce((sum, r) => sum + r.swap, 0);
    const currentFloatPL = currentFloatProfitOnly + currentOpenSwap;

    // HARDCORE: Prioritize backend-calculated source of truth
    const finalDeposit = typeof backendDeposit === 'number' ? backendDeposit : hardcoreDeposit;
    const finalEquity = typeof backendEquity === 'number' ? backendEquity : (finalDeposit + currentFloatPL);

    // Build real-time balance operations list
    const finalPaymentOps = rawPayments.filter(p => {
      const type = String(p.transaction_type || p.transactionType || '').toLowerCase();
      const status = String(p.status || '').toLowerCase();
      const msg = String((p as any).admin_message || (p as any).adminMessage || '').toLowerCase();
      const isReduction = (type === 'settled' || type === 'withdrawal') && msg.includes('investment reduction');
      const isIncrease = type === 'charge' || type === 'deposit';
      return (status === 'completed' || status === 'approved' || status === 'settled') && (isIncrease || isReduction);
    }).map(p => {
      const type = String(p.transaction_type || p.transactionType || '').toLowerCase();
      const msg = String((p as any).admin_message || (p as any).adminMessage || '');
      const isReduction = (type === 'settled' || type === 'withdrawal') && msg.toLowerCase().includes('investment reduction');
      const isInitial = connectAt ? Math.abs(toMs(p.createdAt || p.created_at) - toMs(connectAt)) < 300000 : true;
      return {
        type: (isReduction ? 'WITHDRAWAL' : 'DEPOSIT') as BalanceOp["type"],
        amount: Number(p.capital || p.amount || 0),
        time: String(p.createdAt || p.created_at || ""),
        comment: isReduction ? (msg || 'Reduce Investment') : (isInitial ? 'Initial Investment' : (msg || 'Top-up Investment'))
      };
    });

    const depositOps: BalanceOp[] = (hardcoreDeposit > 0 && finalPaymentOps.length === 0) ? [{
      type: 'DEPOSIT',
      amount: hardcoreDeposit,
      time: String(connectAt || ""),
      comment: 'Initial Investment'
    }] : finalPaymentOps;

    const settlementCommissionOps: BalanceOp[] = totalCommission > 0 ? [{
      type: 'COMMISSION',
      amount: totalCommission,
      time: String(settlements[0]?.created_at || settlements[0]?.settlement_end || ""),
      comment: `Total Commission`
    }] : [];

    const withdrawalOps: BalanceOp[] = totalWithdrawal > 0 ? [{
      type: 'WITHDRAWAL',
      amount: totalWithdrawal,
      time: String(settlements[0]?.created_at || settlements[0]?.settlement_end || ""),
      comment: 'Total Withdrawal'
    }] : [];

    const balanceOperations = [...depositOps, ...settlementCommissionOps, ...withdrawalOps]
      .sort((a, b) => toMs(b.time) - toMs(a.time));

    return {
      deposit: `${finalDeposit.toFixed(2)} ${strategyCurrency}`,
      withdrawal: `${totalWithdrawal.toFixed(2)} ${strategyCurrency}`,
      profit: `${totalRealizedProfit.toFixed(2)} ${strategyCurrency}`, 
      swap: `${(totalRealizedSwap + currentOpenSwap).toFixed(2)} ${strategyCurrency}`,
      commission: `${totalCommission.toFixed(2)} ${strategyCurrency}`,
      balance: `${calculatedLockedBalance.toFixed(2)} ${strategyCurrency}`, 
      equity: `${finalEquity.toFixed(2)} ${strategyCurrency}`,
      floatPL: `${currentFloatPL.toFixed(2)} ${strategyCurrency}`,
      balanceOperations,
    };
  }, [filteredClosed, filteredOpen, settlements, payments, params.id, connectAt, rsId, runningCapital, investmentTimeline, backendEquity, backendDeposit, strategyCurrency]);

  const openInvestmentModal = (action: 'add' | 'reduce') => {
    setInvestmentError(null);
    setInvestmentAmount('');
    setInvestmentModal({ open: true, action });
  };

  const closeInvestmentModal = () => {
    if (investmentBusy) return;
    setInvestmentModal({ open: false, action: null });
    setInvestmentError(null);
    setInvestmentAmount('');
  };

  const submitInvestmentChange = async () => {
    if (!rsId || !investmentModal.action) return;
    const amt = Number(investmentAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setInvestmentError('Please enter a valid amount.');
      return;
    }
    setInvestmentBusy(true);
    setInvestmentError(null);
    try {
      const res = await fetch(`/api/strategies/running/${rsId}/investment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: investmentModal.action, amount: amt }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to update investment.');
      }
      // refresh wallet/payments + running strategy snapshot
      const payRes = await fetch('/api/payments', { cache: 'no-store' });
      if (payRes.ok) {
        const payJson = await payRes.json();
        setPayments(payJson.payments || []);
      }
      // HARDCORE REFRESH: Immediately fetch latest equity/deposit from backend
      const invRes = await fetch(`/api/strategies/running/${rsId}/investment?t=${Date.now()}`, { cache: 'no-store' });
      const invData = await invRes.json().catch(() => null);
      if (invRes.ok && invData?.success) {
        if (typeof invData.equity === 'number') setBackendEquity(invData.equity);
        if (typeof invData.deposit === 'number') setBackendDeposit(invData.deposit);
      }

      await loadHistory();
      closeInvestmentModal();
    } catch (e: any) {
      setInvestmentError(e?.message || 'Failed to update investment.');
    } finally {
      setInvestmentBusy(false);
    }
  };

  const displayRows = useMemo(() => {
    if (filter === "opened") return filteredOpen;
    if (filter === "closed") return filteredClosed.sort((a, b) => (toMs(b.closeTimeStr) || 0) - (toMs(a.closeTimeStr) || 0));
    return stats.balanceOperations;
  }, [filter, filteredOpen, filteredClosed, stats.balanceOperations]);

  const ENTRIES_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(displayRows.length / ENTRIES_PER_PAGE));
  const currentPage = Math.min(historyPage, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ENTRIES_PER_PAGE;
    return displayRows.slice(start, start + ENTRIES_PER_PAGE);
  }, [displayRows, currentPage, ENTRIES_PER_PAGE]);

  return (
    <UserLayout>
      <div className="min-h-screen bg-[#f1f3f6] text-gray-900 px-4 py-8 sm:px-6 font-sans">
        <div className="max-w-7xl mx-auto space-y-4">

          {/* Layer 1: Strategy Header Row */}
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
                  Equal x{selectedLotSize}
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
              <button
                onClick={() => openInvestmentModal('add')}
                className="flex items-center gap-2 text-[#00d09c] text-xs font-bold uppercase tracking-tight hover:opacity-80 transition-opacity"
              >
                <FiPlusCircle className="w-4 h-4" />
                Add Investment
              </button>
              <button
                onClick={() => openInvestmentModal('reduce')}
                className="flex items-center gap-2 text-gray-700 text-xs font-bold uppercase tracking-tight hover:opacity-80 transition-opacity"
              >
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
                    src={`https://flagcdn.com/w20/${userProfile?.country?.toLowerCase?.()}.png`}
                    alt=""
                    className="w-4 h-3 object-contain"
                  />
                  <span className="text-sm text-gray-400 font-medium">
                    {userProfile?.country || "Unknown"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-12 md:gap-16 lg:gap-24">
              <div className="text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Status</p>
                <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${strategyStatus.isActive
                    ? "bg-[#00d09c] text-white"
                    : "bg-red-500 text-white"
                  }`}>
                  {strategyStatus.label}
                </span>
              </div>

              <div className="text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Lot-size mode</p>
                <p className="text-lg font-black text-gray-900">Equal X {selectedLotSize}</p>
              </div>

              <div className="text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Leverage</p>
                <p className="text-lg font-black text-gray-900">1.500</p>
              </div>

              <div className="text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Commission</p>
                <p className="text-lg font-black text-gray-900">
                  {Number(strategy?.parameters?.commission || strategy?.parameters?.commissionPercent || 30).toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* History Data Layer */}
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden p-6 sm:p-10">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-6">History</h2>

            <div className="mb-8 px-6 py-4 bg-blue-100/50 rounded-xl border border-blue-100 text-blue-600 text-[11px] font-bold flex items-center gap-3">
              <FiAlertCircle className="w-4 h-4" />
              Live data from MT5 terminal (real-time)
            </div>

            <div className="flex flex-wrap items-center justify-between gap-6 mb-8 border-b border-gray-50 pb-2">
              <div className="flex gap-8">
                <button
                  onClick={() => { setFilter('closed'); setHistoryPage(1); }}
                  className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 border-transparent text-gray-400 hover:text-gray-600`}
                >
                  CLOSED ORDERS
                  {filter === 'closed' && <div className="border w-full h-1 bg-[#00d09c] rounded-full" />}
                </button>
                <button
                  onClick={() => { setFilter('opened'); setHistoryPage(1); }}
                  className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 border-transparent text-gray-400 hover:text-gray-600`}
                >
                  OPEN ORDERS ({filteredOpen.length})
                  {filter === 'opened' && <div className="border w-full h-1 bg-[#00d09c] rounded-full" />}
                </button>
                <button
                  onClick={() => { setFilter('balance'); setHistoryPage(1); }}
                  className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 border-transparent text-gray-400 hover:text-gray-600`}
                >
                  BALANCE OPERATIONS
                  {filter === 'balance' && <div className="border w-full h-1 bg-[#00d09c] rounded-full" />}
                </button>
              </div>
            </div>

            {/* Real-time Stats summary row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-2 gap-y-6 mb-12 px-4">
              {filter === 'closed' ? (
                <>
                  <div className="flex flex-col items-center">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.deposit}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">DEPOSIT</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100 lg:border-l-0">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.withdrawal}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">WITHDRAWAL</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.profit}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">PROFIT</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100 lg:border-l-0">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.swap}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">SWAP</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.commission}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">COMMISSION</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.balance}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">LOCKED BALANCE</p>
                  </div>
                </>
              ) : filter === 'opened' ? (
                <>
                  <div className="flex flex-col items-center">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.deposit}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">DEPOSIT</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100 lg:border-l-0">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.withdrawal}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">WITHDRAWAL</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.profit}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">PROFIT</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100 lg:border-l-0">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.swap}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">SWAP</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.equity}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">EQUITY</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.floatPL}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">FP/L</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.deposit}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">DEPOSIT</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100 lg:border-l-0">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.withdrawal}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">WITHDRAWAL</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.profit}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">PROFIT</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100 lg:border-l-0">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.swap}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">SWAP</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.commission}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">COMMISSION</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">{stats.balance}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">LOCKED BALANCE</p>
                  </div>
                </>
              )}
            </div>

            <div className="w-full overflow-x-auto overflow-y-hidden">
              <table className="w-full text-left border-collapse table-fixed min-w-[1000px] lg:min-w-0">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50">
                    {filter === 'balance' ? (
                      <>
                        <th className="px-4 py-5 w-[20%]">OPERATION TYPE</th>
                        <th className="px-4 py-5 w-[20%]">DATE & TIME</th>
                        <th className="px-4 py-5 w-[40%]">DESCRIPTION</th>
                        <th className="px-4 py-5 text-right w-[20%]">AMOUNT (USD)</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-5 w-[12%]">SYMBOL</th>
                        <th className="px-4 py-5 w-[8%]">TYPE</th>
                        <th className="px-4 py-5 w-[14%]">OPENING TIME</th>
                        {filter !== 'opened' && <th className="px-4 py-5 w-[14%]">CLOSING TIME {sortOrder === 'desc' ? '↓' : '↑'}</th>}
                        <th className="px-4 py-5 w-[8%]">LOTS</th>
                        <th className="px-4 py-5 w-[10%]">OPEN PRICE</th>
                        <th className="px-4 py-5 w-[10%]">CLOSE PRICE</th>
                        <th className="px-4 py-5 w-[12%]">SWAP</th>
                        <th className="px-4 py-5 text-right w-[12%]">PROFIT</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={filter === 'balance' ? 4 : 9} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 opacity-30">
                          <FiActivity className="w-12 h-12 text-gray-400" />
                          <span className="text-sm font-black uppercase tracking-widest text-gray-400">No data found</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedRows.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-all group">
                      {filter === 'balance' ? (
                        <>
                          <td className="px-4 py-6">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs border transition-all ${row.type === 'DEPOSIT' ? 'bg-green-50 text-green-600 border-green-100' :
                                  row.type === 'WITHDRAWAL' ? 'bg-red-50 text-red-600 border-red-100' :
                                    'bg-blue-50 text-blue-600 border-blue-100'
                                }`}>
                                {row.type === 'DEPOSIT' ? <FiPlusCircle /> : row.type === 'WITHDRAWAL' ? <FiMinusCircle /> : <FiDollarSign />}
                              </div>
                              <span className="text-[10px] font-black text-gray-900 uppercase tracking-tight">{row.type}</span>
                            </div>
                          </td>
                          <td className="px-4 py-6">
                            <p className="text-[10px] font-black text-gray-900">{formatDateShort(row.time)}</p>
                          </td>
                          <td className="px-4 py-6">
                            <p className="text-[10px] font-bold text-gray-400 truncate" title={row.comment}>{row.comment}</p>
                          </td>
                          <td className="px-4 py-6 text-right">
                            <span className={`text-xs font-black ${row.type === 'DEPOSIT' ? 'text-[#00d09c]' : 'text-red-500'}`}>
                              {row.type === 'DEPOSIT' ? '+' : '-'}${Number(row.amount).toFixed(2)}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-6">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {row.symbol?.toLowerCase().includes('xau') ? (
                                  <div className="w-full h-full bg-yellow-500 flex items-center justify-center text-white text-[8px] font-black">AU</div>
                                ) : row.symbol?.toLowerCase().includes('btc') ? (
                                  <div className="w-full h-full bg-orange-500 flex items-center justify-center text-white text-[8px] font-black">BT</div>
                                ) : (
                                  <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white text-[8px] font-black">{row.symbol?.slice(0, 2).toUpperCase()}</div>
                                )}
                              </div>
                              <span className="text-[10px] font-black text-gray-900 truncate">{row.symbol}</span>
                            </div>
                          </td>
                          <td className="px-4 py-6">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${String(row.type).toLowerCase().includes('buy')
                                ? 'bg-blue-50 text-blue-500 border-blue-100'
                                : 'bg-red-50 text-red-500 border-red-100'
                              }`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="px-4 py-6">
                            <p className="text-[10px] font-bold text-gray-600 whitespace-nowrap">{formatDateShort(row.openTimeStr)}</p>
                          </td>
                          {filter !== 'opened' && (
                            <td className="px-4 py-6">
                              <p className="text-[10px] font-bold text-gray-600 whitespace-nowrap">{row.closeTimeStr ? formatDateShort(row.closeTimeStr) : "Current"}</p>
                            </td>
                          )}
                          <td className="px-4 py-6">
                            <p className="text-[10px] font-black text-gray-900">{Number(row.volume).toFixed(2)}</p>
                          </td>
                          <td className="px-4 py-6">
                            <p className="text-[10px] font-bold text-gray-600">{Number(row.openPrice).toFixed(5)}</p>
                          </td>
                          <td className="px-4 py-6">
                            <p className="text-[10px] font-bold text-gray-600">{Number(row.closeOrCurrentPrice).toFixed(5)}</p>
                          </td>
                          <td className="px-4 py-6">
                            <p className="text-[10px] font-bold text-gray-600 whitespace-nowrap">{Number(row.swap || 0).toFixed(2)} {strategyCurrency}</p>
                          </td>
                          <td className="px-4 py-6 text-right">
                            <p className={`text-[10px] font-black whitespace-nowrap ${Number(row.profit) >= 0 ? 'text-[#00d09c]' : 'text-red-500'}`}>
                              {Number(row.profit) >= 0 ? '+' : ''}{Number(row.profit).toFixed(2)} {strategyCurrency}
                            </p>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Layer */}
            {totalPages > 1 && (
              <div className="p-8 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">PAGE {currentPage} OF {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100 disabled:opacity-30 hover:bg-gray-100 transition-all"
                  >
                    <FiChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                    className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100 disabled:opacity-30 hover:bg-gray-100 transition-all"
                  >
                    <FiChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Investment Modal */}
      {investmentModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeInvestmentModal} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                  {investmentModal.action === 'add' ? 'Add Investment' : 'Reduce Investment'}
                </p>
                <p className="text-sm font-bold text-gray-900 mt-1">
                  {strategy?.name || 'Strategy'}
                </p>
              </div>
              <button className="text-gray-400 hover:text-gray-600" onClick={closeInvestmentModal} disabled={investmentBusy}>
                <FiXCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">
                  Amount ({strategyCurrency})
                </label>
                <input
                  value={investmentAmount}
                  onChange={(e) => setInvestmentAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="Enter amount"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00d09c]/30 focus:border-[#00d09c] text-sm font-bold text-gray-900"
                  disabled={investmentBusy}
                />
              </div>

              {isUSC && investmentAmount && Number.isFinite(Number(investmentAmount)) && (
                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">
                  Equivalent to approx. ${(Number(investmentAmount) / 100).toFixed(2)} USD
                </div>
              )}

              {investmentError && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-[12px] font-bold">
                  {investmentError}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={closeInvestmentModal}
                  disabled={investmentBusy}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 text-xs font-black uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitInvestmentChange}
                  disabled={investmentBusy}
                  className="flex-1 px-4 py-3 rounded-xl bg-[#00d09c] text-white text-xs font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
                >
                  {investmentBusy ? 'Processing…' : (investmentModal.action === 'add' ? 'Confirm Add' : 'Confirm Reduce')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </UserLayout>
  );
}

function StatCard({ title, value, icon, color, trend }: { title: string; value: string; icon: React.ReactNode; color: string; trend?: 'up' | 'down' }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-[#00d09c] border-green-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-4 rounded-2xl border ${colors[color]} group-hover:scale-110 transition-transform`}>
          {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: "w-6 h-6" }) : icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
            {trend === 'up' ? <FiArrowUpRight className="w-4 h-4" /> : <FiArrowDownLeft className="w-4 h-4" />}
            {trend === 'up' ? 'Growth' : 'Loss'}
          </div>
        )}
      </div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1.5">{title}</p>
      <p className="text-2xl font-black text-gray-900 tracking-tight">{value}</p>
    </div>
  );
}

function FilterTab({ active, label, onClick, count }: { active: boolean; label: string; onClick: () => void; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${active ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
    >
      {label}
      {count !== undefined && (
        <span className={`px-2 py-0.5 rounded-lg text-[8px] ${active ? 'bg-[#00d09c] text-white' : 'bg-gray-200 text-gray-500'}`}>{count}</span>
      )}
    </button>
  );
}

function formatDateShort(dateStr: string | number | undefined) {
  if (!dateStr) return "-";
  const ms = Number.isFinite(Number(dateStr)) ? (Number(dateStr) < 10000000000 ? Number(dateStr) * 1000 : Number(dateStr)) : Date.parse(String(dateStr).replace(/\./g, '-'));
  if (!Number.isFinite(ms)) return String(dateStr);
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
