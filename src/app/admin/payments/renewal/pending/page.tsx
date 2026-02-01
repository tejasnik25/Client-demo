"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowPathIcon, CheckCircleIcon, XCircleIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
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
  createdAt?: string;
  status: string;
  mt4mt5?: string;
};

const RenewalPendingPage = () => {
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [strategyFilter, setStrategyFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [showModal, setShowModal] = useState(false);
  const [modal, setModal] = useState({ action: "", paymentId: "", message: "" });

  const load = async () => {
    try {
      const res = await fetch(`/api/payments?renewal=true`);
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
    return rows
      .filter((p) => p.status === "pending" || p.status === "in_process")
      .filter((p) => {
        const s = `${p.userId} ${p.txId} ${p.strategyId}`.toLowerCase();
        const matchesSearch = s.includes(search.toLowerCase());
        const matchesMethod = methodFilter ? p.method === methodFilter : true;
        const matchesStrategy = strategyFilter ? p.strategyId === strategyFilter : true;
        const matchesUser = userFilter ? p.userId === userFilter : true;
        const matchesDate = withinDate(p.createdAt);
        return matchesSearch && matchesMethod && matchesStrategy && matchesUser && matchesDate;
      });
  }, [rows, search, methodFilter, strategyFilter, userFilter, dateFrom, dateTo]);

  const handleAction = (action: string, paymentId: string) => {
    setModal({ action, paymentId, message: "" });
    setShowModal(true);
  };

  const submitAction = async () => {
    try {
      const status = modal.action === "approve" ? "renewal_approved" : modal.action === "reject" ? "rejected" : "pending";
      const res = await fetch(`/api/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: modal.paymentId, status, message: modal.message })
      });
      if (!res.ok) throw new Error("Failed to update payment status");
      setShowModal(false);
      setModal({ action: "", paymentId: "", message: "" });
      await load();
    } catch (e) {
      console.error(e);
    }
  };

  const methods = Array.from(new Set(rows.map((p) => p.method).filter(Boolean)));
  const strategies = Array.from(new Set(rows.map((p) => p.strategyId).filter(Boolean)));
  const users = Array.from(new Set(rows.map((p) => p.userId).filter(Boolean)));

  return (
    <div className="p-4 md:p-6 bg-gray-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Renewal — Pending</h1>
        <div className="table-toolbar">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="toolbar-input" />
          <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="toolbar-select">
            <option value="">Method</option>
            {methods.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select value={strategyFilter} onChange={(e) => setStrategyFilter(e.target.value)} className="toolbar-select">
            <option value="">Strategy</option>
            {strategies.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="toolbar-select">
            <option value="">User</option>
            {users.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
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
              <th>Proof (Image)</th>
              <th>Date Submitted</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="py-6 text-center">Loading...</td>
              </tr>
            ) : filtered.length > 0 ? (
              filtered.map((p) => (
                <tr key={p.id}>
                  <td>{p.userId}</td>
                  <td>{p.txId}</td>
                  <td>-</td>
                  <td>{p.strategyId}</td>
                  <td>{p.plan}</td>
                  <td>${p.payable.toFixed(2)}</td>
                  <td>{p.proofUrl ? <a href={p.proofUrl} target="_blank" rel="noreferrer" className="underline">View</a> : "-"}</td>
                  <td>{p.createdAt ? new Date(p.createdAt).toLocaleString() : "-"}</td>
                  <td><span className={`status-badge badge-pending`}>{p.status === "in_process" ? "In-process" : "Pending"}</span></td>
                  <td className="flex gap-2">
                    <button onClick={() => handleAction("approve", p.id)} className="p-2 bg-green-600 rounded-full hover:bg-green-500" title="Approve">
                      <CheckCircleIcon className="h-5 w-5"/>
                    </button>
                    <button onClick={() => handleAction("reject", p.id)} className="p-2 bg-red-600 rounded-full hover:bg-red-500" title="Reject">
                      <XCircleIcon className="h-5 w-5"/>
                    </button>
                    <button onClick={() => handleAction("message", p.id)} className="p-2 bg-blue-600 rounded-full hover:bg-blue-500" title="Send Message">
                      <PaperAirplaneIcon className="h-5 w-5"/>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="empty-3d text-center py-6">No records found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 capitalize">{modal.action} Renewal</h2>
            {(modal.action === "reject" || modal.action === "message") && (
              <div className="mb-4">
                <label className="block mb-2">Reason</label>
                <textarea className="w-full p-2 bg-gray-700 rounded-lg" rows={4} value={modal.message} onChange={(e) => setModal({ ...modal, message: e.target.value })}/>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-600 rounded-lg">Cancel</button>
              <button onClick={submitAction} className="px-4 py-2 bg-blue-600 rounded-lg">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RenewalPendingPage;