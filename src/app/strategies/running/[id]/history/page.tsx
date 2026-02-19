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
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

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
      const res = await fetch(`/api/strategies/${params.id}/master-history`, { cache: "no-store" });
      const data = await res.json();
      setHistory(data.history || []);
    };
    loadHistory();
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

  const adjusted = useMemo(() => {
    const mult = Number(lotSize) || 1;
    return history.map((h) => ({
      ...h,
      profit: Number(h.profit) * mult,
    }));
  }, [history, lotSize]);

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
            <h1 className="text-2xl font-bold text-gray-900">Closed Positions History</h1>
            <p className="text-sm text-gray-600">{strategy?.name || "Strategy"} • Lot Size: {lotSize}</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/strategies/running")}>
            Back
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Closed Positions (Adjusted)</h3>
            <span className="text-xs text-gray-500">Profit = Lot size × Master profit</span>
          </div>
          <div className="overflow-x-auto">
            {adjusted.length > 0 ? (
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
                  {adjusted.map((pos, idx) => (
                    <tr key={pos.position_id || idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                        {pos.server_time_open || new Date((pos.time_open || 0) * 1000).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                        {pos.server_time_close || new Date((pos.time_close || 0) * 1000).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{pos.symbol}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            pos.type === 0 || pos.type === "buy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {pos.type === 0 ? "BUY" : pos.type === 1 ? "SELL" : String(pos.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{pos.volume}</td>
                      <td className="px-6 py-4 text-gray-600">{pos.price_open}</td>
                      <td className="px-6 py-4 text-gray-600">{pos.price_close}</td>
                      <td className={`px-6 py-4 font-bold ${pos.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {pos.profit > 0 ? "+" : ""}{Number(pos.profit).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-gray-500 text-sm">No closed positions yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
