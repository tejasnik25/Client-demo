"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import "../../../../styles/themes.css";

type Payment = {
  id: string;
  userId: string;
  strategyId: string;
  plan: string;
  payable: number;
  method: string;
  txId: string;
  status: string;
  updatedAt?: string;
  verifiedBy?: string;
  message?: string; // rejection_reason from API
};

const PaymentsRejectedPage = () => {
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
      const res = await fetch(`/api/payments?renewal=false`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load payments");
      const payments: Payment[] = data.payments ?? [];
      setRows(payments.filter((p) => p.status === "failed" || p.status === "rejected"));
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
        <h1 className="text-2xl font-bold">Payments — Rejected</h1>
        <div className="table-toolbar">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID, TX, Strategy" className="toolbar-input" />
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
              <th>Transaction ID</th>
              <th>User Name</th>
              <th>Strategy</th>
              <th>Plan</th>
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
                <tr key={p.id}>
                  <td>{p.userId}</td>
                  <td>{p.txId}</td>
                  <td>-</td>
                  <td>{p.strategyId}</td>
                  <td>{p.plan}</td>
                  <td>${p.payable.toFixed(2)}</td>
                  <td>{p.method}</td>
                  <td>{p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "-"}</td>
                  <td>{p.verifiedBy ?? "-"}</td>
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
    </div>
  );
};

export default PaymentsRejectedPage;