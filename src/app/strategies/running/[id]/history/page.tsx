"use client";

/**
 * Copier History page (Octa Copy–style): shows Master's MT5 trades to the copying user.
 * - Strategy has Master A linked (admin). User A pays for Strategy A → after approval, sees it here.
 * - "Opened" tab = Master A's current open positions on MT5 (same as Terminal → Trade).
 * - "Closed" tab = Master A's closed positions (same as MT5 Terminal → History tab).
 * Data comes from master-history API (live from MT5 via Python trading service, no cache).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Button from "@/components/ui/Button";
import UserLayout from "@/components/UserLayout";
import { COUNTRY_OPTIONS } from '@/utils/countries';
import { FiChevronLeft, FiChevronRight, FiPlusCircle, FiMinusCircle, FiXCircle, FiExternalLink, FiChevronDown, FiActivity, FiClock, FiDollarSign, FiBarChart2, FiArrowUpRight, FiArrowDownLeft, FiUser, FiAlertCircle } from "react-icons/fi";

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
const LOT_SIZE_USER_OVERRIDES: Record<string, number> = {
  user_1775738809201: 2,
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

export default function CopierHistoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [openPositions, setOpenPositions] = useState<OpenItem[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [runningLotSize, setRunningLotSize] = useState<number | null>(null);
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
    return { label: "Stopped", isActive: false };
  }, [adminStatus, mtStatus]);

  const toMs = (v: string | number | null | undefined): number => {
    if (v == null || v === "") return NaN;
    if (typeof v === "string") {
      let t = Date.parse(v);
      if (!Number.isFinite(t)) {
        t = Date.parse(v.replace(/\./g, '-'));
      }
      if (!Number.isFinite(t)) {
        const m = v.match(/^(\d{4})[\.\-/](\d{2})[\.\-/](\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
        if (m) {
          const [_, yy, MM, dd, hh, mm, ss] = m;
          const d = new Date(Number(yy), Number(MM) - 1, Number(dd), Number(hh), Number(mm), Number(ss));
          t = d.getTime();
        }
      }
      return Number.isFinite(t) ? t : NaN;
    }
    const num = Number(v);
    if (!Number.isFinite(num)) return NaN;
    return num < 10000000000 ? num * 1000 : num;
  };

  const selectedLotSize = useMemo(() => {
    const normalizeId = (v: any) => String(v ?? '').trim();
    const currentStrategyId = normalizeId(params.id);
    const currentRsId = normalizeId(rsId);

    const candidatePaymentLot = payments
      .filter((p) => {
        const pStrategyId = normalizeId((p as any).strategyId ?? (p as any).strategy_id);
        const pRsId = normalizeId((p as any).runningStrategyId ?? (p as any).running_strategy_id);
        return (
          (pStrategyId && pStrategyId === currentStrategyId) ||
          (currentRsId && pRsId && pRsId === currentRsId)
        );
      })
      .map((p) => Number(p.lotSize ?? 0))
      .filter((lot) => Number.isFinite(lot) && lot > 0)
      .sort((a, b) => b - a)[0];

    // 1. Derive from running capital and strategy lotPricing (hard fallback when lot columns are missing)
    let derivedLot = 0;
    try {
      const rawPricing = strategy?.parameters?.lotPricing;
      if (rawPricing && Number(runningCapital) > 0) {
        const parsed = typeof rawPricing === 'string' ? JSON.parse(rawPricing) : rawPricing;
        if (Array.isArray(parsed) && parsed.length > 0) {
          const rows = parsed
            .map((x: any) => ({ lot: Number(x?.lot), amountUSD: Number(x?.amountUSD) }))
            .filter((x: any) => Number.isFinite(x.lot) && x.lot > 0 && Number.isFinite(x.amountUSD) && x.amountUSD > 0);
          if (rows.length > 0) {
            const one = rows.find((x: any) => x.lot === 1);
            const unitPrice = one ? one.amountUSD : (rows[0].amountUSD / rows[0].lot);
            if (Number.isFinite(unitPrice) && unitPrice > 0) {
              const derived = Number(runningCapital) / unitPrice;
              if (Number.isFinite(derived) && derived > 0) {
                const rounded = Math.round(derived);
                derivedLot = Math.abs(derived - rounded) < 0.12 && rounded > 0 ? rounded : Number(derived.toFixed(2));
              }
            }
          }
        }
      }
    } catch {
      // ignore and continue fallback chain
    }

    // 2. Hardcoded per-user override for legacy inconsistent rows
    const forcedLot = sessionUserId ? Number(LOT_SIZE_USER_OVERRIDES[sessionUserId] || 0) : 0;
    const rowLot = Number(runningLotSize || 0);
    const txLot = Number(candidatePaymentLot || 0);
    const drvLot = Number(derivedLot || 0);

    // Treat row lot 1 as weak default; prefer stronger (>1) evidence.
    if (forcedLot > 1) return forcedLot;
    if (txLot > 1) return txLot;
    if (drvLot > 1) return drvLot;
    if (rowLot > 1) return rowLot;

    if (forcedLot > 0) return forcedLot;
    if (txLot > 0) return txLot;
    if (drvLot > 0) return drvLot;
    if (rowLot > 0) return rowLot;

    // 3. Fallback: Strategy default lot size
    const strategyLot = Number(strategy?.parameters?.lotSize ?? strategy?.parameters?.lot_size ?? strategy?.parameters?.lot_mode?.match(/\d+/)?.[0] ?? 1);
    return Number.isFinite(strategyLot) && strategyLot > 0 ? strategyLot : 1;
  }, [strategy, payments, params.id, rsId, runningLotSize, sessionUserId, runningCapital]);

  const loadHistory = useCallback(async () => {
    if (!params.id) return;
    try {
      const [hRes, runRes] = await Promise.all([
        fetch(`/api/strategies/${params.id}/master-history?t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/strategies/running`, { cache: "no-store" })
      ]);

      if (!hRes.ok) {
        setHistoryError(`Failed to load history: ${hRes.statusText}`);
        setHistoryLoading(false);
        return;
      }

      const data = await hRes.json();
      if (!data.cached) {
        setRealtimeFetchFailed(false);
        setOpenPositions(data.open_positions || []);
      } else {
        setRealtimeFetchFailed(true);
        setOpenPositions([]);
      }
      setHistory(data.history || []);
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
      const s = (stratData.strategies || []).find((x: any) => x.id === params.id);
      setStrategy(s || null);
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
      const openMs = toMs((h.server_time_open ?? h.time_open) ?? (h.open_time ?? h.time));
      const closeMs = toMs((h.server_time_close ?? h.time_close) ?? (h.close_time ?? h.time));
      if (!Number.isFinite(openMs) && !Number.isFinite(closeMs)) return true;
      const effectiveMs = Number.isFinite(openMs) ? openMs : closeMs;

      // Apply the user-specific platform creation date filter
      if (!filterBySpecificUserDate(effectiveMs)) return false;

      if (runningPeriods.length === 0) {
        const connectTs = connectAt ? toMs(connectAt) : NaN;
        return !Number.isFinite(connectTs) || effectiveMs >= connectTs;
      }
      return runningPeriods.some(p => {
        const start = toMs(p.start_time);
        const end = p.end_time ? toMs(p.end_time) : Infinity;
        return effectiveMs >= start && effectiveMs <= end;
      });
    }).map(h => {
      const normalizedType = toTradeSide(h);
      const normalizedSymbol = toDisplaySymbol(h.symbol ?? (h as any).Symbol ?? (h as any).instrument ?? (h as any).Instrument);

      return {
      isOpen: false,
      openTimeStr: String(((h.server_time_open ?? h.time_open) ?? (h.open_time ?? h.time)) || ""),
      closeTimeStr: String(((h.server_time_close ?? h.time_close) ?? (h.close_time ?? h.time)) || ""),
      symbol: normalizedSymbol,
      type: normalizedType,
      volume: Number(h.volume || 0) * selectedLotSize,
      openPrice: h.price_open,
      closeOrCurrentPrice: h.price_close,
      profit: Number(h.profit) * selectedLotSize,
      swap: Number(h.swap || 0) * selectedLotSize,
      };
    });
  }, [history, connectAt, runningPeriods, sessionUserId, strategyStatus.isActive, selectedLotSize]);

  const filteredOpen = useMemo(() => {
    // If status is not running/copying, don't show open trades
    if (!strategyStatus.isActive) return [];

    const filterBySpecificUserDate = (openMs: number) => {
      if (sessionUserId === 'user_1772105441338') {
        const platformStartDate = new Date('2026-04-02T00:00:00Z').getTime();
        return openMs >= platformStartDate;
      }
      return true;
    };

    const lotMultiplier = selectedLotSize;

    return openPositions.filter(p => {
      const openMs = toMs((p.server_time || p.server_time_open) || (p.time_open || (p.open_time || p.time)));
      if (!Number.isFinite(openMs)) return true;

      // Apply user-specific filter
      if (!filterBySpecificUserDate(openMs)) return false;

      if (runningPeriods.length === 0) {
        const connectTs = connectAt ? toMs(connectAt) : NaN;
        return !Number.isFinite(connectTs) || openMs >= connectTs;
      }
      return runningPeriods.some(pr => {
        const start = toMs(pr.start_time);
        const end = pr.end_time ? toMs(pr.end_time) : Infinity;
        return openMs >= start && openMs <= end;
      });
    }).map(p => {
      const mt5Lot = Number(p.volume || 0);
      const calculatedLot = mt5Lot * lotMultiplier;

      const tradeType = toTradeSide(p);

      const rawSymbol =
        (p as any).symbol ??
        (p as any).Symbol ??
        (p as any).instrument ??
        (p as any).Instrument ??
        'UNKNOWN';
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
      };
    });
  }, [openPositions, connectAt, runningPeriods, sessionUserId, strategyStatus.isActive, selectedLotSize]);

  const stats = useMemo(() => {
    // Real-time deposit: use the running strategy's current capital as the base
    const deposit = Number(runningCapital || 0);

    // Real-time summary stats
    const realizedProfitOnly = filteredClosed.reduce((sum, r) => sum + r.profit, 0);
    const realizedSwapOnly = filteredClosed.reduce((sum, r) => sum + r.swap, 0);

    const settlementTotals = settlements.reduce((acc, row) => ({
      profit: acc.profit + Number(row.gross_profit || row.profit || 0),
      swap: acc.swap + Number(row.swap_amount || row.swap || 0),
      commission: acc.commission + Number(row.commission_amount || row.commission || 0),
      withdrawal: acc.withdrawal + Math.max(0, Number(row.withdrawal_amount || row.withdrawal || 0)),
    }), { profit: 0, swap: 0, commission: 0, withdrawal: 0 });

    const latestSettlement = [...settlements].sort((a, b) => {
      const aEnd = toMs(a.settlementEnd || a.settlement_end || a.settlementEnd || 0);
      const bEnd = toMs(b.settlementEnd || b.settlement_end || b.settlementEnd || 0);
      if (aEnd !== bEnd) return bEnd - aEnd;
      const aCreated = toMs(a.createdAt || a.created_at || a.settlement_created_at || 0);
      const bCreated = toMs(b.createdAt || b.created_at || b.settlement_created_at || 0);
      return bCreated - aCreated;
    })[0];
    const lastSettledCommission = Number(latestSettlement?.commission_amount || latestSettlement?.commission || 0);

    const totalRealizedProfit = realizedProfitOnly + settlementTotals.profit;
    const totalRealizedSwap = realizedSwapOnly + settlementTotals.swap;
    
    // Commission is only updated when admin runs settlement; between settlements it remains fixed
    const displayCommission = lastSettledCommission;
    
    // FP/L: Sum of all open trade profits
    const currentFloatProfitOnly = filteredOpen.reduce((sum, r) => sum + r.profit, 0);
    // Open Swap: Sum of all swaps of the open trades
    const currentOpenSwap = filteredOpen.reduce((sum, r) => sum + r.swap, 0);
    
    const currentFloatPL = currentFloatProfitOnly + currentOpenSwap;
    
    // Balance: Deposit + Total Realized Profit + Total Realized Swap - Commission (10%) - Settled Withdrawals
    // This ensures the balance correctly reflects the net state after potential commission.
    const realizedBalance = deposit + totalRealizedProfit + totalRealizedSwap - displayCommission - settlementTotals.withdrawal;
    
    // Total Real-time Swap: Realized Swap + Current Open Swap
    const totalRealtimeSwap = totalRealizedSwap + currentOpenSwap;
    
    // Equity = Balance + FP/L
    const currentEquity = realizedBalance + currentFloatPL;

    // Build real-time balance operations list
    const depositOps: BalanceOp[] = [{
      type: 'DEPOSIT',
      amount: deposit,
      time: String(connectAt || ""),
      comment: 'Initial Investment'
    }];

    // Add any subsequent deposits from payments
    const additionalDeposits: BalanceOp[] = payments.filter(p => {
      const type = String(p.transaction_type || p.transactionType || '').toLowerCase();
      const status = String(p.status || '').toLowerCase();
      const isLater = connectAt ? toMs(p.createdAt || p.created_at) > toMs(connectAt) : false;
      return type === 'deposit' && (status === 'completed' || status === 'approved') && isLater;
    }).map(p => ({
      type: 'DEPOSIT',
      amount: Number(p.capital || p.amount || 0),
      time: String(p.createdAt || p.created_at || ""),
      comment: p.admin_message || 'Top-up Investment'
    }));

    // Commission/Withdrawal ops are ONLY from settlements
    const settlementCommissionOps: BalanceOp[] = settlements.filter(s => Number(s.commission_amount || 0) > 0).map(s => ({
      type: 'COMMISSION',
      amount: Number(s.commission_amount || 0),
      time: String(s.created_at || s.settlement_end || ""),
      comment: `Settled Commission`
    }));

    const withdrawalOps: BalanceOp[] = settlements.filter(s => Number(s.withdrawal_amount || 0) > 0).map(s => ({
      type: 'WITHDRAWAL',
      amount: Number(s.withdrawal_amount || 0),
      time: String(s.created_at || s.settlement_end || ""),
      comment: 'Settled Withdrawal'
    }));

    const balanceOperations = [...depositOps, ...additionalDeposits, ...settlementCommissionOps, ...withdrawalOps]
      .sort((a, b) => toMs(b.time) - toMs(a.time));

    return {
      deposit: deposit.toFixed(2),
      withdrawal: settlementTotals.withdrawal.toFixed(2),
      profit: totalRealizedProfit.toFixed(2), 
      swap: totalRealtimeSwap.toFixed(2), // Real-time Swap = sum of all swaps (realized + open)
      commission: displayCommission.toFixed(2),
      balance: realizedBalance.toFixed(2), 
      equity: currentEquity.toFixed(2),
      floatPL: currentFloatPL.toFixed(2),
      balanceOperations,
    };
  }, [filteredClosed, filteredOpen, payments, strategy, settlements, runningCapital, connectAt]);

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
                  {Number(strategy?.parameters?.commission ?? strategy?.parameters?.commissionPercent ?? 0).toFixed(2)}%
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
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.deposit}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">DEPOSIT</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100 lg:border-l-0">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.withdrawal}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">WITHDRAWAL</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.profit}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">PROFIT</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100 lg:border-l-0">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.swap}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">SWAP</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.commission}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">COMMISSION</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.balance}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">BALANCE</p>
                  </div>
                </>
              ) : filter === 'opened' ? (
                <>
                  <div className="flex flex-col items-center">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.deposit}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">DEPOSIT</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100 lg:border-l-0">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.withdrawal}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">WITHDRAWAL</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.profit}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">PROFIT</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100 lg:border-l-0">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.swap}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">SWAP</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.equity}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">EQUITY</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.floatPL}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">FP/L</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.deposit}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">DEPOSIT</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100 lg:border-l-0">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.withdrawal}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">WITHDRAWAL</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.profit}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">PROFIT</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100 lg:border-l-0">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.swap}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">SWAP</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.commission}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">COMMISSION</p>
                  </div>
                  <div className="flex flex-col items-center border-l border-gray-100">
                    <p className="text-[20px] sm:text-[24px] font-bold text-gray-900 tracking-tight">${stats.balance}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-1.5 text-center">LOCKED BALANCE</p>
                  </div>
                </>
              )}
            </div>

            <div className="w-full">
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50">
                    {filter === 'balance' ? (
                      <>
                        <th className="px-8 py-5">OPERATION TYPE</th>
                        <th className="px-8 py-5">DATE & TIME</th>
                        <th className="px-8 py-5">DESCRIPTION</th>
                        <th className="px-8 py-5 text-right">AMOUNT (USD)</th>
                      </>
                    ) : (
                      <>
                        <th className="px-8 py-5">SYMBOL</th>
                        <th className="px-8 py-5">TYPE</th>
                        <th className="px-8 py-5">OPENING TIME, UTC</th>
                        {filter !== 'opened' && <th className="px-8 py-5">CLOSING TIME, UTC {sortOrder === 'desc' ? '↓' : '↑'}</th>}
                        <th className="px-8 py-5">LOTS</th>
                        <th className="px-8 py-5">OPENING PRICE</th>
                        <th className="px-8 py-5">CLOSING PRICE</th>
                        <th className="px-8 py-5">SWAP, USD</th>
                        <th className="px-8 py-5 text-right">PROFIT, USD</th>
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
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs border transition-all ${row.type === 'DEPOSIT' ? 'bg-green-50 text-green-600 border-green-100' :
                                  row.type === 'WITHDRAWAL' ? 'bg-red-50 text-red-600 border-red-100' :
                                    'bg-blue-50 text-blue-600 border-blue-100'
                                }`}>
                                {row.type === 'DEPOSIT' ? <FiPlusCircle /> : row.type === 'WITHDRAWAL' ? <FiMinusCircle /> : <FiDollarSign />}
                              </div>
                              <span className="text-[11px] font-black text-gray-900 uppercase tracking-tight">{row.type}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-[11px] font-black text-gray-900">{formatDateShort(row.time)}</p>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-[11px] font-bold text-gray-400">{row.comment}</p>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <span className={`text-sm font-black ${row.type === 'DEPOSIT' ? 'text-[#00d09c]' : 'text-red-500'}`}>
                              {row.type === 'DEPOSIT' ? '+' : '-'}${Number(row.amount).toFixed(2)}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden">
                                {row.symbol?.toLowerCase().includes('xau') ? (
                                  <div className="w-full h-full bg-yellow-500 flex items-center justify-center text-white text-[10px] font-black">AU</div>
                                ) : row.symbol?.toLowerCase().includes('btc') ? (
                                  <div className="w-full h-full bg-orange-500 flex items-center justify-center text-white text-[10px] font-black">BT</div>
                                ) : (
                                  <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-black">{row.symbol?.slice(0, 2).toUpperCase()}</div>
                                )}
                              </div>
                              <span className="text-[11px] font-black text-gray-900">{row.symbol}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${String(row.type).toLowerCase().includes('buy')
                                ? 'bg-blue-50 text-blue-500 border-blue-100'
                                : 'bg-red-50 text-red-500 border-red-100'
                              }`}>
                              {row.type}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-[11px] font-bold text-gray-600">{formatDateShort(row.openTimeStr)}</p>
                          </td>
                          {filter !== 'opened' && (
                            <td className="px-8 py-6">
                              <p className="text-[11px] font-bold text-gray-600">{row.closeTimeStr ? formatDateShort(row.closeTimeStr) : "Current"}</p>
                            </td>
                          )}
                          <td className="px-8 py-6">
                            <p className="text-[11px] font-black text-gray-900">{Number(row.volume).toFixed(2)}</p>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-[11px] font-bold text-gray-600">{Number(row.openPrice).toFixed(5)}</p>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-[11px] font-bold text-gray-600">{Number(row.closeOrCurrentPrice).toFixed(5)}</p>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-[11px] font-bold text-gray-600">{Number(row.swap || 0).toFixed(2)}</p>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <p className={`text-[11px] font-black ${Number(row.profit) >= 0 ? 'text-[#00d09c]' : 'text-red-500'}`}>
                              {Number(row.profit) >= 0 ? '+' : ''}{Number(row.profit).toFixed(2)}
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
