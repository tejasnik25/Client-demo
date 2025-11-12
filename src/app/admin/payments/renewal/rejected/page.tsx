"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import "../../../../../styles/themes.css";

type Payment = {
  id: string;
  userId: string;
  txId: string;
  strategyId: string;
  plan: string;
  payable: number;
  method: string;
  proofUrl?: string;
  updatedAt?: string;
  status: string;
  message?: string;
};

const RenewalRejectedPage = () => {
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [strategyFilter, setStrategyFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [detail, setDetail] = useState<Payment | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/payments?renewal=true`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load payments");
      setRows((data.payments ?? []).filter((p: any) => p.status === "rejected" || p.status === "failed"));
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
      const matchesDate = withinDate(p.updatedAt);
      return matchesSearch && matchesMethod && matchesStrategy && matchesUser && matchesDate;
    });
  }, [rows, search, methodFilter, strategyFilter, userFilter, dateFrom, dateTo]);

  const methods = Array.from(new Set(rows.map((p) => p.method).filter(Boolean)));
  const strategies = Array.from(new Set(rows.map((p) => p.strategyId).filter(Boolean)));
  const users = Array.from(new Set(rows.map((p) => p.userId).filter(Boolean)));

  return (
    <div className="p-4 md:p-6 bg-gray-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Renewal — Rejected</h1>
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
              <th>Rejected Date</th>
              <th>Rejected By</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="py-6 text-center">Loading...</td></tr>
            ) : filtered.length > 0 ? (
              filtered.map((p) => (
                <tr key={p.id} className="cursor-pointer" onClick={() => setDetail(p)}>
                  <td>{p.userId}</td>
                  <td>{p.txId}</td>
                  <td>-</td>
                  <td>{p.strategyId}</td>
                  <td>{p.plan}</td>
                  <td>${p.payable.toFixed(2)}</td>
                  <td>{p.method}</td>
                  <td>{p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "-"}</td>
                  <td>-</td>
                  <td>{p.message ?? "-"}</td>
                  <td><span className="status-badge badge-rejected">Rejected</span></td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={11} className="empty-3d text-center py-6">No records found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" onClick={() => setDetail(null)}>
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-3">Rejection Details</h2>
            <div className="space-y-2 text-sm text-gray-200">
              <div><span className="text-gray-400">Reason:</span> {detail.message ?? "-"}</div>
              <div>
                <span className="text-gray-400">Proof:</span> {detail.proofUrl ? (
                  <a href={detail.proofUrl} className="underline" target="_blank" rel="noreferrer">View Image</a>
                ) : (
                  "-"
                )}
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button className="px-4 py-2 bg-gray-600 rounded-lg" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RenewalRejectedPage;