"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import UserLayout from "@/components/UserLayout";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FiSettings } from "react-icons/fi";

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

const RunningStrategiesPage: React.FC = () => {
  const [running, setRunning] = useState<RunningItem[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsItem, setSettingsItem] = useState<any | null>(null);
  const [mtType, setMtType] = useState<'MT4' | 'MT5' | ''>('');
  const [mtId, setMtId] = useState('');
  const [mtPwd, setMtPwd] = useState('');
  const [mtServer, setMtServer] = useState('');
  const [saving, setSaving] = useState(false);

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

  const renderAdminStatusBadge = (s: string) => {
    const k = (s || '').toLowerCase();
    if (k === 'running') return <Badge variant="success">Running</Badge>;
    if (k === 'in-process') return <Badge variant="warning">In-Process</Badge>;
    if (k === 'wrong-account-password') return <Badge variant="destructive">Wrong-Account Password</Badge>;
    if (k === 'wrong-account-id') return <Badge variant="destructive">Wrong-Account Id</Badge>;
    if (k === 'wrong-account-server-name') return <Badge variant="destructive">Wrong-Account Server Name</Badge>;
    return <Badge variant="outline">{s || 'in-process'}</Badge>;
  };

  const openSettings = (r: any) => {
    setSettingsItem(r);
    setMtType((r.platform as any) || '');
    setMtId((r.mtAccountId as any) || '');
    setMtPwd((r.mtAccountPassword as any) || '');
    setMtServer((r.mtAccountServer as any) || '');
    setSettingsOpen(true);
  };

  const submitSettings = async () => {
    if (!settingsItem) return;
    try {
      setSaving(true);
      const body: any = {};
      const adminStatus = (settingsItem.adminStatus || settingsItem.status || '').toLowerCase();
      if (adminStatus === 'running') {
        body.mt_account_password = mtPwd;
      } else {
        body.platform = mtType || undefined;
        body.mt_account_id = mtId || undefined;
        body.mt_account_password = mtPwd || undefined;
        body.mt_account_server = mtServer || undefined;
      }
      const res = await fetch(`/api/running-strategies/${(settingsItem as any).rsId || settingsItem.id}/modification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to submit update');
      setSettingsOpen(false);
      const runRes = await fetch('/api/strategies/running', { cache: 'no-store' });
      const runData = await runRes.json();
      setRunning(runData?.strategies || []);
    } catch (e) {
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <UserLayout>
      <div className="min-h-screen bg-[#0f1527] text-white px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Running Strategy</h1>
            <p className="text-sm text-gray-400">Approved and active strategies</p>
          </div>
          <Link href="/strategies?view=deployed">
            <Button className="bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:from-[#6d28d9] hover:to-[#9333ea]">Open Deployed View</Button>
          </Link>
        </div>

        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : running.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-[#1a1f2e] rounded-2xl border border-[#283046]">
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
                <div key={r.id} className="group fx-3d-card bg-gradient-to-r from-[#1a1f2e] to-[#161d31] rounded-2xl p-6 border border-[#283046]">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-14 h-14 bg-gradient-to-br from-[#7c3aed] to-[#a855f7] rounded-xl flex items-center justify-center p-2">
                        <div className="w-8 h-8 bg-white/20 rounded" />
                      </div>
                        <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-semibold">{s.name}</h4>
                          {renderAdminStatusBadge(((r as any).adminStatus || (r as any).status || 'in-process') as string)}
                          <button className="ml-auto text-gray-400 hover:text-white" title="Settings" onClick={() => openSettings(r)}>
                            <FiSettings />
                          </button>
                        </div>
                        <div className="flex gap-2 mt-2">
                          {s.tag && (
                            <span className="text-xs px-2 py-1 bg-[#7c3aed] text-white rounded-full">{s.tag}</span>
                          )}
                          {s.category && (
                            <span className="text-xs px-2 py-1 bg-[#283046] rounded-full uppercase">{s.category}</span>
                          )}
                          {s.riskLevel && (
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              s.riskLevel === 'High' ? 'bg-red-900/30 text-red-300' :
                              s.riskLevel === 'Medium' ? 'bg-yellow-900/30 text-yellow-300' :
                              'bg-green-900/30 text-green-300'
                            }`}>
                              {s.riskLevel}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-gray-400">{s.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-8 text-sm justify-center items-center w-full md:w-auto">
                      <div>
                        <div className="text-gray-500 text-center">Status</div>
                        <div className="mt-2 flex justify-center">{renderAdminStatusBadge(((r as any).adminStatus || (r as any).status || 'in-process') as string)}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 w-full md:w-auto md:flex md:gap-3">
                      <Link href={`/payment?strategy=${s.id}`}>
                        <Button className="h-11 w-full md:w-auto bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:from-[#6d28d9] hover:to-[#9333ea]">Renewal</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </UserLayout>
    <Dialog open={settingsOpen} onOpenChange={(o) => setSettingsOpen(o)}>
      <DialogContent className="max-w-lg bg-[#161d31] text-white border-[#283046]">
        <DialogHeader>
          <DialogTitle className="text-xl">Strategy Settings</DialogTitle>
          <DialogDescription className="text-gray-400">Update your MT4/MT5 account details</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select
              className="px-3 py-2 rounded border border-[#283046] bg-[#0f1527]"
              value={mtType}
              onChange={(e) => setMtType(e.target.value as any)}
              disabled={(settingsItem?.adminStatus || settingsItem?.status || '').toLowerCase() === 'running'}
            >
              <option value="">Select Platform</option>
              <option value="MT4">MT4</option>
              <option value="MT5">MT5</option>
            </select>
            <input
              className="px-3 py-2 rounded border border-[#283046] bg-[#0f1527]"
              placeholder="Account ID"
              value={mtId}
              onChange={(e) => setMtId(e.target.value)}
              disabled={(settingsItem?.adminStatus || settingsItem?.status || '').toLowerCase() === 'running'}
            />
          </div>
          <input
            className="w-full px-3 py-2 rounded border border-[#283046] bg-[#0f1527]"
            placeholder="Account Password"
            value={mtPwd}
            onChange={(e) => setMtPwd(e.target.value)}
          />
          <input
            className="w-full px-3 py-2 rounded border border-[#283046] bg-[#0f1527]"
            placeholder="Server Name"
            value={mtServer}
            onChange={(e) => setMtServer(e.target.value)}
            disabled={(settingsItem?.adminStatus || settingsItem?.status || '').toLowerCase() === 'running'}
          />
        </div>
        <DialogFooter>
          <Button onClick={submitSettings} disabled={saving} className="bg-[#7367f0] hover:bg-[#5e50ee]">
            {saving ? 'Saving...' : 'Submit' }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default RunningStrategiesPage;