"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

type HistoryItem = {
  position_id?: string;
  time_open?: number;
  time_close?: number;
  server_time_open?: string;
  server_time_close?: string;
  symbol: string;
  type: number | string;
  volume: number;
  price_open: number;
  price_close: number;
  profit: number;
};

type OpenItem = {
  server_time?: string;
  time?: number;
  symbol: string;
  type: number | string;
  volume: number;
  price_open: number;
  price_current: number;
  profit: number;
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
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [rsId, setRsId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [stratRes, paymentsRes, meRes] = await Promise.all([
          fetch("/api/strategies", { cache: "no-store" }),
          fetch("/api/payments", { cache: "no-store" }),
          fetch("/api/me", { cache: "no-store" }).catch(() => null),
        ]);
        const stratData = await stratRes.json();
        const s = (stratData.strategies || []).find((x: any) => x.id === params.id);
        setStrategy(s || null);
        const payJson = await paymentsRes.json();
        setPayments(payJson.payments || []);
        if (meRes && meRes.ok) {
          const me = await meRes.json().catch(() => null);
          setSessionUserId(me?.user?.id || null);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.id]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!params.id) return;
      setHistoryLoading(true);
      const [hRes, runRes] = await Promise.all([
        fetch(`/api/strategies/${params.id}/master-history?t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/strategies/running`, { cache: "no-store" })
      ]);
      const data = await hRes.json();
      setHistory(data.history || []);
      setOpenPositions(data.open_positions || []);
      setHistoryError(data.error || null);
      const runData = await runRes.json().catch(() => null);
      const me = Array.isArray(runData?.strategies) ? runData.strategies.find((x: any) => x.strategyId === params.id) : null;
      const status = String(me?.adminStatus || me?.status || '').toLowerCase();
      const runningLike = status === 'running' || status === 'active' || status === 'in-process' || status === 'in process';
      const connectedAt = runningLike ? (me?.updatedAt || me?.createdAt || null) : (me?.createdAt || null);
      setConnectAt(connectedAt);
      setAdminStatus(me?.adminStatus || me?.status || null);
      setUpdatedAt(me?.updatedAt || null);
      setRsId(me?.rsId || null);
      setHistoryLoading(false);
    };
    loadHistory();
  }, [params.id]);

  // Fetch latest disconnect snapshot when not running/active
  useEffect(() => {
    const fetchSnapshot = async () => {
      const status = String(adminStatus || '').toLowerCase();
      if (!rsId) return;
      const isDisc = status === 'disconnected' || status === 'stopped';
      if (!isDisc) {
        setSnapshot(null);
        return;
      }
      try {
        const res = await fetch(`/api/running-strategies/${rsId}/snapshot`, { cache: 'no-store' });
        if (res.ok) {
          const js = await res.json();
          setSnapshot(js?.snapshot || null);
        } else {
          setSnapshot(null);
        }
      } catch {
        setSnapshot(null);
      }
    };
    fetchSnapshot();
  }, [adminStatus, rsId]);

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

  // Normalize timestamps safely (handles server strings, ms vs s epochs)
  const toMs = (v: string | number | undefined): number => {
    if (v == null) return NaN;
    if (typeof v === "string") {
      const t = Date.parse(v);
      if (Number.isFinite(t)) return t;
      const m = v.match(/^(\d{4})\.(\d{2})\.(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
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
        const ts = d.getTime();
        return Number.isFinite(ts) ? ts : NaN;
      }
      return NaN;
    }
    const num = Number(v);
    if (!Number.isFinite(num)) return NaN;
    return num < 1e12 ? num * 1000 : num;
  };

  // Compute effective start timestamp: prefer connectAt; fallback to latest approved/completed payment; if none, show all
  const effectiveStartTs = useMemo(() => {
    const fromConnect = connectAt ? new Date(connectAt).getTime() : NaN;
    if (Number.isFinite(fromConnect)) return fromConnect;
    const approved = [...payments]
      .filter(p => p.strategyId === params.id)
      .filter(p => {
        const st = String(p.status || '').toLowerCase();
        return st === 'approved' || st === 'completed' || st === 'renewal_approved' || st === 'in-process';
      })
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
    const t = approved[0]?.createdAt ? new Date(approved[0].createdAt as any).getTime() : NaN;
    return Number.isFinite(t) ? t : NaN;
  }, [connectAt, payments, params.id]);

  const filteredClosed = useMemo(() => {
    const startTs = effectiveStartTs;
    const endTs = (adminStatus && ((() => { const s = String(adminStatus).toLowerCase(); return s === 'disconnected' || s === 'stopped'; })()))
      ? (updatedAt ? new Date(updatedAt).getTime() : NaN)
      : NaN;
    const mult = Number(lotSize) || 1;
    // Only include closed trades OPENED after connectAt and (if disconnected) OPENED before or at endTs and CLOSED before or at endTs
    const base = history.filter((h) => {
      // if no startTs, include all
      if (!Number.isFinite(startTs)) {
        if (Number.isFinite(endTs)) {
          const openMs0 = toMs(h.server_time_open ?? h.time_open);
          const closeMs0 = toMs(h.server_time_close ?? h.time_close);
          if (Number.isFinite(openMs0) && openMs0 > endTs) return false;
          if (Number.isFinite(closeMs0) && closeMs0 > endTs) return false;
        }
        return true;
      }
      const openMs = toMs(h.server_time_open ?? h.time_open);
      if (!(Number.isFinite(openMs) && openMs >= startTs)) return false;
      if (Number.isFinite(endTs)) {
        if (openMs > endTs) return false;
        const closeMs = toMs(h.server_time_close ?? h.time_close);
        if (Number.isFinite(closeMs) && closeMs > endTs) return false;
      }
      return true;
    });
    const rows = base.length === 0 && history.length > 0 ? history : base;
    return rows.map((h) => ({
      isOpen: false as const,
      openTimeStr: h.server_time_open || (Number.isFinite(h.time_open) ? new Date(toMs(h.time_open!)).toISOString() : ""),
      closeTimeStr: h.server_time_close || (Number.isFinite(h.time_close) ? new Date(toMs(h.time_close!)).toISOString() : ""),
      symbol: h.symbol,
      type: h.type,
      volume: Number(h.volume) * mult,
      openPrice: h.price_open,
      closeOrCurrentPrice: h.price_close,
      profit: Number(h.profit) * mult,
    }));
  }, [history, lotSize, effectiveStartTs, adminStatus, updatedAt]);

  const filteredOpen = useMemo(() => {
    const endTs = (adminStatus && ((() => { const s = String(adminStatus).toLowerCase(); return s === 'disconnected' || s === 'stopped'; })()))
      ? (updatedAt ? new Date(updatedAt).getTime() : NaN)
      : NaN;
    const mult = Number(lotSize) || 1;
    const rows = openPositions.filter((p) => {
      if (Number.isFinite(endTs)) return false;
      return true;
    });
    return rows.map((p) => ({
      isOpen: true as const,
      openTimeStr: p.server_time || (Number.isFinite(p.time) ? new Date(toMs(p.time!)).toISOString() : ""),
      closeTimeStr: "",
      symbol: p.symbol,
      type: p.type,
      volume: Number(p.volume) * mult,
      openPrice: p.price_open,
      closeOrCurrentPrice: p.price_current,
      profit: Number(p.profit) * mult,
    }));
  }, [openPositions, lotSize, effectiveStartTs, adminStatus, updatedAt]);

  // Synthesize closures at disconnect time for any positions that were open at the cutoff
  const syntheticClosures = useMemo(() => {
    const startTs = effectiveStartTs;
    const endTs = (adminStatus && (String(adminStatus).toLowerCase() !== 'running' && String(adminStatus).toLowerCase() !== 'active'))
      ? (updatedAt ? new Date(updatedAt).getTime() : NaN)
      : NaN;
    const mult = Number(lotSize) || 1;
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return [];
    // Prefer snapshot positions at disconnect; fallback to current open positions
    const src = Array.isArray(snapshot?.positions) && snapshot.positions.length > 0 ? snapshot.positions : openPositions;
    // Take any open position whose open time is in [startTs, endTs]
    const rows = src.filter((p: any) => {
      const openMs = toMs(p.server_time ?? p.time);
      return Number.isFinite(openMs) && openMs >= startTs && openMs <= endTs;
    });
    return rows.map((p: any) => ({
      isOpen: false as const,
      openTimeStr: p.server_time || (Number.isFinite(p.time) ? new Date(toMs(p.time!)).toISOString() : ""),
      closeTimeStr: new Date(endTs).toISOString(),
      symbol: p.symbol,
      type: p.type,
      volume: Number(p.volume) * mult,
      openPrice: p.price_open,
      closeOrCurrentPrice: p.price_current,
      profit: Number(p.profit) * mult,
    }));
  }, [openPositions, lotSize, effectiveStartTs, adminStatus, updatedAt, snapshot]);

  const displayRows = useMemo(() => {
    const isRunning = String(adminStatus || '').toLowerCase() === 'running' || String(adminStatus || '').toLowerCase() === 'active';
    const closedRows = [...filteredClosed, ...(!isRunning ? syntheticClosures : [])];
    if (filter === "opened") return isRunning ? filteredOpen : [];
    if (filter === "closed") return closedRows.sort((a, b) => {
      const ta = Date.parse(a.openTimeStr || "") || 0;
      const tb = Date.parse(b.openTimeStr || "") || 0;
      return tb - ta;
    });
    return [...(isRunning ? filteredOpen : []), ...closedRows].sort((a, b) => {
      const ta = Date.parse(a.openTimeStr || "") || 0;
      const tb = Date.parse(b.openTimeStr || "") || 0;
      return tb - ta;
    });
  }, [filter, filteredOpen, filteredClosed, syntheticClosures, adminStatus]);

  const [lastRows, setLastRows] = useState<any[]>([]);
  useEffect(() => {
    if (displayRows.length > 0) setLastRows(displayRows);
  }, [displayRows]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">View History</h1>
            <p className="text-sm text-gray-600">{strategy?.name || "Strategy"} • Lot Size: {lotSize}</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/strategies/running")}>
            Back
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">
                {filter === "all" ? "All Trades" : filter === "opened" ? "Opened Positions" : "Closed Positions"} (Adjusted)
              </h3>
              <span className="text-xs text-gray-500">Profit = Lot size × Master profit</span>
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
            {(displayRows.length > 0 || lastRows.length > 0) ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-semibold">
                  <tr>
                    <th className="px-6 py-3">Open Time</th>
                    <th className="px-6 py-3">Close Time</th>
                    <th className="px-6 py-3">Symbol</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Volume</th>
                    <th className="px-6 py-3">Open Price</th>
                    <th className="px-6 py-3">Close Price</th>
                    <th className="px-6 py-3">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(displayRows.length > 0 ? displayRows : lastRows).map((pos, idx) => (
                    <tr key={`${pos.symbol}-${pos.openTimeStr}-${idx}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                        {pos.openTimeStr ? new Date(pos.openTimeStr).toLocaleString() : "-"}
                      </td>
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                        {pos.closeTimeStr ? new Date(pos.closeTimeStr).toLocaleString() : "-"}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{pos.symbol}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            pos.type === 0 || pos.type === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {pos.type === 0 ? "BUY" : (pos as any).type === 1 ? "SELL" : String((pos as any).type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{(pos as any).volume}</td>
                      <td className="px-6 py-4 text-gray-600">{(pos as any).openPrice}</td>
                      <td className="px-6 py-4 text-gray-600">{(pos as any).closeOrCurrentPrice ?? "-"}</td>
                      <td className={`px-6 py-4 font-bold ${(pos as any).profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {(pos as any).profit > 0 ? "+" : ""}{Number((pos as any).profit).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-gray-500 text-sm">
                {historyError ? historyError : 'No trades yet since activation.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
