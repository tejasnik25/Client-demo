"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowPathIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import "../../../../../styles/themes.css";

type Payment = {
  id: string;
  userId: string;
  txId: string;
  strategyId: string;
  payable: number;
  method: string;
  approvedAt?: string;
  verifiedBy?: string;
  status: string;
};

const RenewalApprovedPage = () => {
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [strategyFilter, setStrategyFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const load = async () => {
    try {
      const res = await fetch(`/api/payments?renewal=true&status=renewal_approved`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load payments");
      setRows(data.payments ?? []);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const withinDate = (d?: string) => {
    if (!d) return true;
    const dt = new Date(d).getTime();
    const fromOk = dateFrom ? dt >= new Date(dateFrom).getTime() : true;
    const toOk = dateTo ? dt <= new Date(dateTo).getTime() : true;
    return fromOk && toOk;
  };

  const filtered = useMemo(() => {
    return rows.filter((p) => {
      const s = `${p.userId} ${p.txId} ${p.strategyId}`.toLowerCase();
      const matchesSearch = s.includes(search.toLowerCase());
      const matchesMethod = methodFilter ? p.method === methodFilter : true;
      const matchesStrategy = strategyFilter ? p.strategyId === strategyFilter : true;
      const matchesUser = userFilter ? p.userId === userFilter : true;
      const matchesDate = withinDate(p.approvedAt);
      return matchesSearch && matchesMethod && matchesStrategy && matchesUser && matchesDate;
    });
  }, [rows, search, methodFilter, strategyFilter, userFilter, dateFrom, dateTo]);

  const exportCSV = (rows: Payment[]) => {
    const header = ["user_id","Renewal ID","User Name","Strategy","Renewal Type","Amount","Payment Method","Approval Date","Expiry Date","Approved By","Status"];
    const csv = [header.join(",")]
      .concat(
        rows.map((p) => {
          const approval = p.approvedAt ? new Date(p.approvedAt).toISOString() : "";
          const expiry = p.approvedAt ? new Date(new Date(p.approvedAt).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() : "";
          const status = expiry && Date.now() <= new Date(expiry).getTime() ? "Active" : "Expired";
          return [p.userId,p.txId,"",p.strategyId,"Yearly",p.payable,p.method,approval,expiry,p.verifiedBy ?? "",status].join(",");
        })
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "renewal-approved.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = (rows: Payment[]) => {
    const html = `
      <table>
        <thead>
          <tr>
            <th>user_id</th>
            <th>Renewal ID</th>
            <th>User Name</th>
            <th>Strategy</th>
            <th>Renewal Type</th>
            <th>Amount</th>
            <th>Payment Method</th>
            <th>Approval Date</th>
            <th>Expiry Date</th>
            <th>Approved By</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((p) => {
              const approval = p.approvedAt ? new Date(p.approvedAt).toLocaleString() : "";
              const expiryMs = p.approvedAt ? new Date(p.approvedAt).getTime() + 365 * 24 * 60 * 60 * 1000 : undefined;
              const expiry = expiryMs ? new Date(expiryMs).toLocaleDateString() : "";
              const status = expiryMs && Date.now() <= expiryMs ? "Active" : "Expired";
              return `<tr><td>${p.userId}</td><td>${p.txId}</td><td></td><td>${p.strategyId}</td><td>Yearly</td><td>${p.payable}</td><td>${p.method}</td><td>${approval}</td><td>${expiry}</td><td>${p.verifiedBy ?? ""}</td><td>${status}</td></tr>`;
            })
            .join("")}
        </tbody>
      </table>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "renewal-approved.xls";
    a.click();
    URL.revokeObjectURL(url);
  };

  const methods = Array.from(new Set(rows.map((p) => p.method).filter(Boolean)));
  const strategies = Array.from(new Set(rows.map((p) => p.strategyId).filter(Boolean)));
  const users = Array.from(new Set(rows.map((p) => p.userId).filter(Boolean)));

  return (
    <div className="p-4 md:p-6 bg-gray-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Renewal — Approved</h1>
        <div className="table-toolbar">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="toolbar-input" />
          <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="toolbar-select">
            <option value="">Method</option>
            {methods.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
          <select value={strategyFilter} onChange={(e) => setStrategyFilter(e.target.value)} className="toolbar-select">
            <option value="">Strategy</option>
            {strategies.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="toolbar-select">
            <option value="">User</option>
            {users.map((u) => (<option key={u} value={u}>{u}</option>))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="toolbar-input" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="toolbar-input" />
          <button onClick={() => load()} className="toolbar-button flex items-center"><ArrowPathIcon className="h-5 w-5 mr-1"/>Refresh</button>
          <button onClick={() => exportCSV(filtered)} className="toolbar-button">CSV</button>
          <button onClick={() => exportExcel(filtered)} className="toolbar-button">Excel</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500 text-white p-3 rounded-lg mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="font-semibold">Retry</button>
        </div>
      )}

      <div className="table-card overflow-x-auto">
        <table className="w-full payments-table table-sticky">
          <thead>
            <tr>
              <th>user_id</th>
              <th>Renewal ID</th>
              <th>User Name</th>
              <th>Strategy</th>
              <th>Renewal Type</th>
              <th>Amount</th>
              <th>Payment Method</th>
              <th>Approval Date</th>
              <th>Expiry Date</th>
              <th>Approved By</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="py-6 text-center">Loading...</td></tr>
            ) : filtered.length > 0 ? (
              filtered.map((p) => {
                const approval = p.approvedAt ? new Date(p.approvedAt) : undefined;
                const expiryMs = approval ? approval.getTime() + 365 * 24 * 60 * 60 * 1000 : undefined;
                const expiryDate = expiryMs ? new Date(expiryMs) : undefined;
                const daysLeft = expiryMs ? Math.ceil((expiryMs - Date.now()) / (1000 * 60 * 60 * 24)) : undefined;
                const active = expiryMs ? Date.now() <= expiryMs : false;
                return (
                  <tr key={p.id}>
                    <td>{p.userId}</td>
                    <td>{p.txId}</td>
                    <td>-</td>
                    <td>{p.strategyId}</td>
                    <td>Yearly</td>
                    <td>${p.payable.toFixed(2)}</td>
                    <td>{p.method}</td>
                    <td>{approval ? approval.toLocaleString() : "-"}</td>
                    <td className="flex items-center gap-2">
                      {expiryDate ? expiryDate.toLocaleDateString() : "-"}
                      {daysLeft !== undefined && daysLeft <= 15 ? (
                        <ExclamationTriangleIcon className="h-4 w-4 text-yellow-400" />
                      ) : null}
                    </td>
                    <td>{p.verifiedBy ?? "-"}</td>
                    <td>
                      <span className={`status-badge ${active ? "badge-active" : "badge-expired"}`}>{active ? "Active" : "Expired"}</span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={11} className="empty-3d text-center py-6">No records found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RenewalApprovedPage;