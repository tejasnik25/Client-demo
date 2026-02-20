"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import "../../../../styles/themes.css";

type Payment = {
  id: string;
  userId: string;
  email: string;
  txId: string;
  plan: string;
  platform: string;
  terms: string;
  strategyId: string;
  payable: number;
  method: string;
  createdAt: string;
  approvedAt?: string;
  expiresAt?: string;
  verifiedBy?: string;
};

const ApprovedPaymentsPage = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [termsFilter, setTermsFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const fetchApproved = async () => {
    setLoading(true);
    try {
      const [res, sres] = await Promise.all([
        fetch(`/api/admin/payments/approved`),
        fetch(`/api/strategies`, { cache: 'no-store' })
      ]);
      if (!res.ok) throw new Error("Failed to load payments");
      const [data, sdata] = await Promise.all([res.json(), sres.ok ? sres.json() : Promise.resolve({ strategies: [] })]);
      const strategies: any[] = Array.isArray(sdata) ? sdata : (sdata.strategies || []);
      const items = Array.isArray(data) ? data : (data.transactions ?? []);
      const normalized: Payment[] = items.map((t: any) => ({
        id: t.id,
        userId: t.user_id,
        email: t.user?.email ?? '',
        txId: t.transaction_id,
        plan: t.plan_level || t.plan,
        platform: '',
        terms: '',
        strategyId: t.strategy?.name ?? t.strategy_id,
        payable: t.amount,
        method: t.payment_method,
        createdAt: t.created_at,
        approvedAt: t.status === 'completed' ? (t.updated_at || t.created_at) : undefined,
        verifiedBy: t.admin_id || undefined,
      }));
      // attach lot size label
      const withLot = normalized.map((p: any) => {
        const s = strategies.find(st => st.id === p.strategyId || st.name === p.strategyId);
        const lp = s?.parameters?.lotPricing;
        if (!lp) return { ...p };
        try {
          const arr = JSON.parse(lp);
          if (!Array.isArray(arr)) return { ...p };
          const rows = arr
            .map((x: any) => ({ amountUSD: Number(x.amountUSD), lot: Number(x.lot) }))
            .filter((x: any) => Number.isFinite(x.amountUSD) && x.amountUSD > 0 && Number.isFinite(x.lot) && x.lot > 0);
          if (rows.length === 0) return { ...p };
          const amt = Number(p.payable);
          if (!Number.isFinite(amt)) return { ...p };
          const exact = rows.find((r: any) => Math.abs(r.amountUSD - amt) < 1e-6);
          const target = exact || rows.reduce((best: any, cur: any) => {
            const dBest = Math.abs(best.amountUSD - amt);
            const dCur = Math.abs(cur.amountUSD - amt);
            return dCur < dBest ? cur : best;
          }, rows[0]);
          return { ...p, lotLabel: `${target.lot} Lot` };
        } catch {
          return { ...p };
        }
      });
      setPayments(withLot as any);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApproved();
    const interval = setInterval(fetchApproved, 60000);
    return () => clearInterval(interval);
  }, []);

  const withinDate = (d?: string) => {
    if (!d) return true;
    const dt = new Date(d).getTime();
    const fromOk = dateFrom ? dt >= new Date(dateFrom).getTime() : true;
    const toOk = dateTo ? dt <= new Date(dateTo).getTime() : true;
    return fromOk && toOk;
  };

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const s = `${p.userId} ${p.txId} ${p.strategyId} ${p.email}`.toLowerCase();
      const matchesSearch = s.includes(search.toLowerCase());
      const matchesMethod = methodFilter ? p.method === methodFilter : true;
      const matchesDate = withinDate(p.approvedAt);
      return matchesSearch && matchesMethod && matchesDate;
    });
  }, [payments, search, methodFilter, dateFrom, dateTo]);

  const exportCSV = (rows: Payment[]) => {
    const header = [
      "user_id",
      "Transaction ID",
      "Email",
      "Amount",
      "Payment Method",
      "Lot Size",
      "Status",
      "Submission Date",
      "Approval Date",
      "Approved By",
      "Strategy Name",
    ];
    const csv = [header.join(",")]
      .concat(
        rows.map((p) => {
          const approval = p.approvedAt ? new Date(p.approvedAt).toISOString() : "";
          const status = p.approvedAt ? "Completed" : "";
          const lot = (p as any).lotLabel || '';
          return [
            p.userId,
            p.txId,
            p.email,
            p.payable,
            p.method,
            lot,
            status,
            new Date(p.createdAt).toISOString(),
            approval,
            p.verifiedBy ?? "",
            p.strategyId,
          ].join(",");
        })
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "approved-payments.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = (rows: Payment[]) => {
    const html = `
      <table>
        <thead>
          <tr>
            <th>user_id</th>
            <th>Transaction ID</th>
            <th>Email</th>
            <th>Amount</th>
            <th>Payment Method</th>
            <th>Lot Size</th>
            <th>Status</th>
            <th>Submission Date</th>
            <th>Approval Date</th>
            <th>Approved By</th>
            <th>Strategy Name</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((p) => {
              const approval = p.approvedAt ? new Date(p.approvedAt).toLocaleString() : "";
              const status = p.approvedAt ? "Completed" : "";
              const lot = (p as any).lotLabel || '';
              return `
                <tr>
                  <td>${p.userId}</td>
                  <td>${p.txId}</td>
                  <td>${p.email}</td>
                  <td>${p.payable}</td>
                  <td>${p.method}</td>
                  <td>${lot}</td>
                  <td>${status}</td>
                  <td>${new Date(p.createdAt).toLocaleString()}</td>
                  <td>${approval}</td>
                  <td>${p.verifiedBy ?? ""}</td>
                  <td>${p.strategyId}</td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "approved-payments.xls";
    a.click();
    URL.revokeObjectURL(url);
  };

  const methods = Array.from(new Set(payments.map((p) => p.method).filter(Boolean)));
  const platforms: string[] = [];
  const terms: string[] = [];

  return (
    <div className="p-4 md:p-6 text-white min-h-screen">
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Approved Payments</h1>
        </div>
        <div className="table-card">
            <div className="table-toolbar">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="toolbar-input"
                />
                <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="toolbar-select">
                    <option value="">All Methods</option>
                    {methods.map((m) => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>
                {/* Platform/Terms filters removed */}
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="toolbar-input" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="toolbar-input" />
                <button onClick={() => fetchApproved()} className="toolbar-button">
                    <ArrowPathIcon className="h-5 w-5" />
                </button>
                <button onClick={() => exportCSV(filtered)} className="toolbar-button">CSV</button>
                <button onClick={() => exportExcel(filtered)} className="toolbar-button">Excel</button>
            </div>

            {error && (
                <div className="bg-red-500 text-white p-3 rounded-lg mb-4 flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={fetchApproved} className="font-semibold">Retry</button>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full payments-table table-sticky">
                    <thead>
                        <tr>
                            <th>User ID</th>
                            <th>Transaction ID</th>
                            <th>Email</th>
                            <th>Amount</th>
                            <th>Payment Method</th>
                            <th>Lot Size</th>
                            <th>Status</th>
                            <th>Submission Date</th>
                            <th>Approval Date</th>
                            <th>Approved By</th>
                            <th>Strategy Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={13} className="py-6 text-center">Loading...</td>
                            </tr>
                        ) : filtered.length > 0 ? (
                            filtered.map((p) => {
                                const approval = p.approvedAt ? new Date(p.approvedAt) : undefined;
                                const active = !!approval;
                                return (
                                    <tr key={p.id}>
                                        <td>{p.userId}</td>
                                        <td>{p.txId}</td>
                                        <td>{p.email}</td>
                                        <td>${p.payable.toFixed(2)}</td>
                                        <td>{p.method}</td>
                                        <td>{(p as any).lotLabel || '-'}</td>
                                        <td>
                                            <span className={`status-badge ${active ? "badge-approved" : "badge-outline"}`}>{
                                                active ? "Completed" : ""
                                            }</span>
                                        </td>
                                        <td>{new Date(p.createdAt).toLocaleString()}</td>
                                        <td>{approval ? approval.toLocaleString() : "-"}</td>
                                        <td>{p.verifiedBy ?? "-"}</td>
                                        <td>{p.strategyId}</td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={13} className="empty-3d text-center py-6">No approved payments found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default ApprovedPaymentsPage;
