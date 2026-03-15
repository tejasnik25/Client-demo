"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import UserLayout from "@/components/UserLayout";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type RunningItem = { id: string; name: string };

type Strategy = {
  id: string;
  name: string;
  description: string;
  performance: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  category: 'Growth' | 'Income' | 'Momentum' | 'Value';
  imageUrl: string;
  // Optional extended fields (present in deployed strategies)
  tag?: string;
  minCapital?: number;
  avgDrawdown?: number;
  riskReward?: number;
  winStreak?: number;
};

const RunningStrategiesPageInner: React.FC = () => {
  const [running, setRunning] = useState<RunningItem[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [runRes, stratRes] = await Promise.all([
          fetch('/api/strategies/running', { cache: 'no-store' }),
          fetch('/api/strategies', { cache: 'no-store' }),
        ]);
        const runData = await runRes.json();
        const stratData = await stratRes.json();
        setRunning(runData?.strategies || []);
        setStrategies((stratData?.strategies || []).filter((s: any) => s.enabled !== false));
      } catch {
        setRunning([]);
        setStrategies([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const stratById = useMemo(() => {
    const map = new Map<string, Strategy>();
    strategies.forEach(s => map.set(s.id, s as any));
    return map;
  }, [strategies]);

 
  const renderAdminStatusBadge = (s: string, r?: any) => {
    const k = (s || '').toLowerCase();
    const content = (() => {
        if (k === 'running') return <Badge variant="success">Connected</Badge>;
        if (k === 'in-process') return <Badge variant="warning">In-Process</Badge>;
        if (k === 'disconnected' || k === 'stopped') return <Badge variant="destructive">Disconnected</Badge>;
        if (k === 'wrong-account-password') return <Badge variant="destructive">Wrong-Account Password</Badge>;
        if (k === 'wrong-account-id') return <Badge variant="destructive">Wrong-Account Id</Badge>;
        if (k === 'wrong-account-server-name') return <Badge variant="destructive">Wrong-Account Server Name</Badge>;
        if (k === 'service error' || k === 'connection failed') return <Badge variant="destructive">{s}</Badge>;
        return <Badge variant="outline">{s || 'in-process'}</Badge>;
    })();

    return (
      <div className="flex items-center gap-2">
        {content}
      </div>
    );
  };

  const toggleDisconnect = async (r: any) => {
    const rsId = (r as any)?.rsId || r?.id;
    const cur = ((r as any)?.adminStatus || (r as any)?.status || '').toLowerCase();
    if (cur === 'disconnected') return; // Prevent disconnect if already disconnected
    const action = 'disconnect';
    if (!confirm(`Are you sure you want to disconnect this strategy?`)) return;
    setPendingIds((prev) => [...prev, rsId]);
    try {
      const res = await fetch(`/api/running-strategies/${rsId}/modification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Failed to request change');
      setRunning((prev: any[]) => prev.map(p => {
        if (((p as any).id || (p as any).rsId) === rsId) {
          return { ...p, adminStatus: 'in-process' };
        }
        return p;
      }));
    } catch (e) {
      console.error(e);
    } finally {
      try {
        const runRes = await fetch('/api/strategies/running', { cache: 'no-store' });
        const runData = await runRes.json();
        setRunning(runData?.strategies || []);
      } catch (e) {
      }
      setPendingIds((prev) => prev.filter(id => id !== rsId));
    }
  };

  const requestEnable = async (r: any) => {
    const rsId = (r as any)?.rsId || r?.id;
    const cur = ((r as any)?.adminStatus || (r as any)?.status || '').toLowerCase();
    if (cur !== 'disconnected' && cur !== 'stopped') return;
    if (!confirm('Connect this strategy again?')) return;
    setPendingIds((prev) => [...prev, rsId]);
    try {
      const res = await fetch(`/api/running-strategies/${rsId}/modification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable' }),
      });
      if (!res.ok) throw new Error('Failed to request enable');
      setRunning((prev: any[]) => prev.map(p => {
        if (((p as any).id || (p as any).rsId) === rsId) {
          return { ...p, adminStatus: 'in-process' };
        }
        return p;
      }));
    } catch (e) {
      console.error(e);
    } finally {
      try {
        const runRes = await fetch('/api/strategies/running', { cache: 'no-store' });
        const runData = await runRes.json();
        setRunning(runData?.strategies || []);
      } catch {}
      setPendingIds((prev) => prev.filter(id => id !== rsId));
    }
  };

 

  return (
    <>
    <UserLayout>
      <div className="min-h-screen bg-gray-50 text-gray-900 px-6 py-8 pb-16 md:pb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Running Strategy</h1>
            <p className="text-sm text-gray-600">Approved and active strategies</p>
          </div>
          <Link href="/dashboard">
            <Button className="bg-green-600 hover:bg-green-600 text-white font-semibold w-full md:w-auto">Open Deployed View</Button>
          </Link>
        </div>

        {loading ? (
          <div className="text-gray-600">Loading...</div>
        ) : running.length === 0 ? (
          <div className="text-center py-16 text-gray-600 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-center mb-4">
              <Image src="/file.svg" alt="No Data" width={64} height={64} />
            </div>
            <div className="text-sm">No approved running strategies yet.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {running.map(r => {
              const s = stratById.get(r.id) || strategies.find(ss => ss.name === (r as any).name);
              if (!s) return null;
              return (
                <div key={r.id} className="group bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="relative w-14 h-14 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center p-2">
                        {((s as any).imageUrl) ? (
                          <img src={(s as any).imageUrl} alt={s.name} className="w-10 h-10 object-contain" />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-[#7c3aed] to-[#a855f7] rounded flex items-center justify-center">
                            <span className="text-white font-bold">{s.name?.charAt(0)?.toUpperCase() || 'S'}</span>
                          </div>
                        )}
                        {(() => {
                          const cc = String(((s as any).parameters || {})?.countryFlag || '').toLowerCase();
                          const isCC = /^[a-z]{2}$/.test(cc);
                          const url = isCC ? `https://flagcdn.com/24x18/${cc}.png` : '';
                          return url ? (
                            <img
                              src={url}
                              alt={cc}
                              className="absolute -left-2 top-1/2 -translate-y-1/2 w-5 h-4 rounded-sm border border-white shadow-sm"
                            />
                          ) : null;
                        })()}
                      </div>
                        <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-semibold text-gray-900">{s.name}</h4>
                          {renderAdminStatusBadge(((r as any).adminStatus || (r as any).status || 'in-process') as string, r)}
                        </div>
                        <div className="flex gap-2 mt-2">
                          {s.tag && (
                            <span className="text-xs px-2 py-1 bg-[#7c3aed] text-white rounded-full">{s.tag}</span>
                          )}
                          {s.category && (
                            <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-full uppercase">{s.category}</span>
                          )}
                          {s.riskLevel && (
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              s.riskLevel === 'High' ? 'bg-red-100 text-red-700' :
                              s.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {s.riskLevel}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-gray-600">{s.description}</p>
                      </div>
                    </div>
                      <div className="flex flex-col items-center gap-1 w-full md:w-auto">
                        <span className="text-gray-500 text-xs font-medium">Status</span>
                        <div className="flex items-center justify-center gap-3">
                          {renderAdminStatusBadge((((r as any).adminStatus || (r as any).status || 'in-process') as string).toLowerCase(), r)}
                          
                          <Link href={`/strategies/running/${s.id}/history`} className="text-gray-600 hover:text-gray-900 text-xs font-medium underline">
                            View History
                          </Link>
                        </div>
                      </div>
                    <div className="grid grid-cols-1 gap-3 w-full md:w-auto md:flex md:gap-3">
                        {(() => {
                          const cur = ((r as any)?.adminStatus || (r as any)?.status || '').toLowerCase();
                          const isPending = pendingIds.includes((r as any)?.rsId || r.id);
                          if (cur === 'disconnected' || cur === 'stopped') {
                            return (
                              <Button
                                size="sm"
                                className="h-11 w-full md:w-auto bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] text-white"
                                onClick={() => requestEnable(r)}
                                disabled={isPending}
                              >
                                {isPending ? 'In-Process' : 'Connect'}
                              </Button>
                            );
                          }
                          const btnClass = 'bg-red-600 hover:bg-red-700';
                          return (
                            <Button
                              size="sm"
                              className={`h-11 w-full md:w-auto ${btnClass} text-white`}
                              onClick={() => toggleDisconnect(r)}
                              disabled={isPending || cur === 'in-process'}
                            >
                              {isPending || cur === 'in-process' ? 'In-Process' : 'Disconnect'}
                            </Button>
                          );
                        })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </UserLayout>
    
    </>
  );
};

const RunningStrategiesPage: React.FC = () => {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-900">Loading running strategies...</div>}>
      <RunningStrategiesPageInner />
    </Suspense>
  );
};

export default RunningStrategiesPage;
