'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

type ModItem = {
  id: string;
  running_strategy_id: string;
  user_id: string;
  platform?: 'MT4' | 'MT5' | null;
  mt_account_id?: string | null;
  mt_account_password?: string | null;
  mt_account_server?: string | null;
  status: string;
  new_update_json?: any;
  created_at?: string;
};

export default function PlanUsageModificationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<ModItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runMap, setRunMap] = useState<Record<string, any>>({});
  const [paymentMap, setPaymentMap] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const formatStatusLabel = (s?: string | null) => {
    if (!s) return '-';
    const normalized = String(s).toLowerCase();
    return normalized.split(/[-_]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  };

  const formatUpdateRequest = (u: any) => {
    if (!u) return '-';
    try {
      if (typeof u === 'string') u = JSON.parse(u);
    } catch (e) {
      // keep as-is
    }
    if (!u || typeof u !== 'object') return String(u);
    const parts: string[] = [];
    if (u.platform) parts.push(`Request to change platform to ${u.platform}`);
    if (u.mt_account_password) parts.push('Request to change password');
    if (u.mt_account_id) parts.push(`Request to change account ID to ${u.mt_account_id}`);
    if (u.mt_account_server) parts.push(`Request to change server to ${u.mt_account_server}`);
    // Add any other fields generically
    Object.keys(u).forEach(k => {
      if (['platform','mt_account_password','mt_account_id','mt_account_server'].includes(k)) return;
      parts.push(`Request to change ${k} to ${u[k]}`);
    });
    return parts.length ? parts.join('; ') : '-';
  };

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || (session?.user as any)?.role !== 'ADMIN') {
      router.push('/admin-login');
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        const [modsRes, runsRes, aprRes] = await Promise.all([
          fetch('/api/admin/running-strategies/modifications', { cache: 'no-store' }),
          fetch('/api/admin/running-strategies', { cache: 'no-store' }),
          fetch('/api/admin/payments/approved', { cache: 'no-store' }),
        ]);
        const modsData = await modsRes.json();
        const runsData = await runsRes.json();
        const aprData = await aprRes.json().catch(() => []);
        const mapLocal: Record<string, any> = {};
        (runsData.strategies || []).forEach((r: any) => { mapLocal[r.id] = { ...(r || {}), adminStatus: (r.adminStatus || r.admin_status || '').toLowerCase() }; });
        const list: ModItem[] = (modsData.modifications || []).map((m: any) => ({
          id: m.id,
          running_strategy_id: m.running_strategy_id,
          user_id: m.user_id,
          platform: m.platform ?? null,
          mt_account_id: m.mt_account_id ?? null,
          mt_account_password: m.mt_account_password ?? null,
          mt_account_server: m.mt_account_server ?? null,
          status: m.status,
          new_update_json: m.new_update_json ? (typeof m.new_update_json === 'string' ? JSON.parse(m.new_update_json) : m.new_update_json) : undefined,
          created_at: m.created_at,
        })).filter((m: any) => ((m.status || '') as string).toLowerCase() !== 'running');
        const filteredList = list.filter((m: any) => {
          const run = mapLocal[m.running_strategy_id] || {};
          const cur = (run.adminStatus || m.status || '').toLowerCase();
          // Exclude modifications that correspond to runs that are already finalized
          return cur !== 'running' && cur !== 'disconnected';
        });
        setRows(filteredList);
        setRunMap(mapLocal);
        const payMap: Record<string, any> = {};
        const pays: any[] = Array.isArray(aprData) ? aprData : (aprData.transactions || []);
        const key = (u: string, s: string) => `${u}::${s}`;
        pays.forEach((t: any) => {
          const strat = t.strategy?.name || t.strategy_id;
          if (!strat) return;
          payMap[key(t.user_id, strat)] = t;
        });
        setPaymentMap(payMap);
        setError(null);
      } catch (e: any) {
        setError(e.message || 'Failed to load modifications');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status, session, router]);

  const handleUpdate = async (_id: string, rsId: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/running-strategies/${rsId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, modId: _id }),
      });
      if (!res.ok) throw new Error('Update failed');
      // Refresh modifications and running strategy map and payments to reflect new status
        const [modsRes, runsRes, aprRes] = await Promise.all([
        fetch('/api/admin/running-strategies/modifications', { cache: 'no-store' }),
        fetch('/api/admin/running-strategies', { cache: 'no-store' }),
        fetch('/api/admin/payments/approved', { cache: 'no-store' }),
      ]);
      const modsData = await modsRes.json();
      const runsData = await runsRes.json();
      const aprData = await aprRes.json().catch(() => []);
        const mapLocal: Record<string, any> = {};
        (runsData.strategies || []).forEach((r: any) => { mapLocal[r.id] = { ...(r || {}), adminStatus: (r.adminStatus || r.admin_status || '').toLowerCase() }; });
        const newRows = (modsData.modifications || []).map((m: any) => ({
        id: m.id,
        running_strategy_id: m.running_strategy_id,
        user_id: m.user_id,
        platform: m.platform ?? null,
        mt_account_id: m.mt_account_id ?? null,
        mt_account_password: m.mt_account_password ?? null,
        mt_account_server: m.mt_account_server ?? null,
        status: m.status,
        new_update_json: m.new_update_json ? (typeof m.new_update_json === 'string' ? JSON.parse(m.new_update_json) : m.new_update_json) : undefined,
        created_at: m.created_at,
      }));
      const filteredNewRows = newRows.filter((m: any) => {
        const run = mapLocal[m.running_strategy_id] || {};
        const cur = (run.adminStatus || m.status || '').toLowerCase();
        return cur !== 'running';
      });
      // Ensure our local state reflects this changed status immediately for rows that remain
      const updatedRows = filteredNewRows.map((r: any) => r.id === _id && r.running_strategy_id === rsId ? { ...r, status } : r);
      setRows(updatedRows);
      const map: Record<string, any> = {};
      (runsData.strategies || []).forEach((r: any) => { map[r.id] = { ...(r || {}), adminStatus: (r.adminStatus || r.admin_status || '').toLowerCase() }; });
      setRunMap(map);
      // Apply the change to the runMap for immediate UI reflection
      setRunMap(prev => ({ ...(prev || {}), [rsId]: { ...(prev?.[rsId] || {}), adminStatus: status } }));
      const payMap: Record<string, any> = {};
      const pays: any[] = Array.isArray(aprData) ? aprData : (aprData.transactions || []);
      const key = (u: string, s: string) => `${u}::${s}`;
      pays.forEach((t: any) => {
        const strat = t.strategy?.name || t.strategy_id;
        if (!strat) return;
        payMap[key(t.user_id, strat)] = t;
      });
      setPaymentMap(payMap);
    } catch (e) {
      console.error('update failed', e);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  const filteredRows = rows.filter((r) => {
    const info = runMap[r.running_strategy_id] || {};
    const plan = info.plan || '';
    const name = info.userName || '';
    const strat = info.strategyName || '';
    const matchesSearch = !searchTerm || r.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) || name?.toLowerCase().includes(searchTerm.toLowerCase()) || strat?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = !planFilter || plan === planFilter;
    const matchesPlatform = !platformFilter || (r.platform || '') === platformFilter;
    const curStatus = (info.adminStatus || r.status || '').toLowerCase();
    if (curStatus === 'running' || curStatus === 'disconnected') return false;
    const actionFromNew = (() => {
      if (!r.new_update_json) return undefined;
      const nu = r.new_update_json;
      if (typeof nu === 'object') {
        if (nu.action) return String(nu.action);
        if (nu.mt_account_password) return 'change-password';
        if (nu.mt_account_id) return 'change-account-id';
        if (nu.mt_account_server) return 'change-server';
        if (nu.platform) return 'change-platform';
      }
      return undefined;
    })();
    const matchesStatus = !statusFilter || curStatus === statusFilter || actionFromNew === statusFilter;
    return matchesSearch && matchesPlan && matchesPlatform && matchesStatus;
  });

  const uniqueStatuses = Array.from(new Set(rows.flatMap(r => {
    const vals: string[] = [];
    const adminStatus = runMap[r.running_strategy_id]?.adminStatus || r.status;
    if (adminStatus) vals.push(adminStatus);
    if (r.new_update_json) {
      const nu = r.new_update_json;
      if (typeof nu === 'object') {
        if (nu.action) vals.push(String(nu.action));
        if (nu.mt_account_password) vals.push('change-password');
        if (nu.mt_account_id) vals.push('change-account-id');
        if (nu.mt_account_server) vals.push('change-server');
        if (nu.platform) vals.push('change-platform');
      } else if (typeof nu === 'string') {
        // try parse
        try {
          const parsed = JSON.parse(nu);
          if (parsed && parsed.action) vals.push(String(parsed.action));
        } catch (e) {
          // ignore
        }
      }
    }
    return vals;
  }))).filter(Boolean) as string[];

  const exportCSV = () => {
    const header = [
      "User ID",
      "User Name",
      "Strategy",
      "Platform",
      "Account ID",
      "Server",
      "Status",
      "New Update Request",
      "Submission Date",
      "Approval Date",
      "Expiry Date"
    ];
    const csv = [header.join(',')]
      .concat(
        filteredRows.map((r) => {
          const info = runMap[r.running_strategy_id] || {};
          const name = info.userName || '';
          const strat = info.strategyName || '';
          const k = `${r.user_id}::${strat}`;
          const pay = paymentMap[k];
          const approval = pay ? (pay.updated_at || pay.created_at) : undefined;
          const expiry = approval ? new Date(new Date(approval).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() : '';
          const submission = pay ? pay.created_at : '';
          const nu = r.new_update_json ? formatUpdateRequest(r.new_update_json) : '';
          return [
            r.user_id || '',
            name || '',
            strat || '',
            r.platform || '',
            r.mt_account_id || '',
            r.mt_account_server || '',
            r.status || '',
            nu || '',
            submission || '',
            approval || '',
            expiry || ''
          ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
        })
      ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modifications.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Note: Export Excel removed — CSV export covers same functionality

  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <Link href="/admin" className="mr-4">Back</Link>
        <h1 className="text-2xl font-bold">Plan Usage Modifications</h1>
      </div>
      {/* Filters & Export */}
      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium mb-1">Search</label>
          <input
            type="text"
            placeholder="Search by User ID, Name or Strategy..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 rounded bg-[#0f1527] border border-[#283046] text-white"
          />
        </div>
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium mb-1">Plan</label>
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="w-full px-3 py-2 rounded bg-[#0f1527] border border-[#283046] text-white">
            <option value="">All Plans</option>
            <option value="Pro">Pro</option>
            <option value="Expert">Expert</option>
            <option value="Premium">Premium</option>
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium mb-1">Platform</label>
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="w-full px-3 py-2 rounded bg-[#0f1527] border border-[#283046] text-white">
            <option value="">All Platforms</option>
            <option value="MT4">MT4</option>
            <option value="MT5">MT5</option>
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium mb-1">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 rounded bg-[#0f1527] border border-[#283046] text-white">
            <option value="">All Statuses</option>
            {uniqueStatuses.map(s => (
              <option key={s} value={s}>{formatStatusLabel(s)}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700">Export CSV</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm payments-table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>User Name</th>
              <th>Strategy</th>
              <th>Platform</th>
              <th>Account ID</th>
              <th>Password</th>
              <th>Server</th>
              <th>Status</th>
              <th>New Update Request</th>
              <th>Submission Date</th>
              <th>Approval Date</th>
              <th>Expiry Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={13} className="empty-3d text-center py-6">No modifications</td></tr>
            ) : (
              filteredRows.map((r) => {
                const info = runMap[r.running_strategy_id] || {};
                const name = info.userName || '-';
                const strat = info.strategyName || '-';
                const nu = r.new_update_json ? formatUpdateRequest(r.new_update_json) : '-';
                const curStatus = info.adminStatus || r.status;
                const k = `${r.user_id}::${strat}`;
                const pay = paymentMap[k];
                const submission = pay ? pay.created_at : undefined;
                const approval = pay ? (pay.updated_at || pay.created_at) : undefined;
                const expiry = approval ? new Date(new Date(approval).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() : undefined;
                return (
                  <tr key={r.id}>
                    <td>{r.user_id}</td>
                    <td>{name}</td>
                    <td>{strat}</td>
                    <td>
                      <select
                        defaultValue={r.platform || ''}
                        className="px-3 py-2 rounded border border-[#283046] bg-[#0f1527]"
                        onChange={(e) => fetch(`/api/admin/running-strategies/${r.running_strategy_id}/details`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: (e.target.value || undefined) as any }) }).then(() => {})}
                      >
                        <option value="">-</option>
                        <option value="MT4">MT4</option>
                        <option value="MT5">MT5</option>
                      </select>
                    </td>
                    <td>{r.mt_account_id || '-'}</td>
                    <td>
                      <input
                        defaultValue={r.mt_account_password || ''}
                        className="px-3 py-2 rounded border border-[#283046] bg-[#0f1527]"
                        placeholder="Password"
                        onBlur={(e) => fetch(`/api/admin/running-strategies/${r.running_strategy_id}/details`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mt_account_password: e.target.value }) }).then(() => {})}
                      />
                    </td>
                    <td>
                      <input
                        defaultValue={r.mt_account_server || ''}
                        className="px-3 py-2 rounded border border-[#283046] bg-[#0f1527]"
                        placeholder="Server"
                        onBlur={(e) => fetch(`/api/admin/running-strategies/${r.running_strategy_id}/details`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mt_account_server: e.target.value }) }).then(() => {})}
                      />
                    </td>
                    <td><Badge variant={curStatus === 'running' ? 'success' : curStatus === 'in-process' ? 'warning' : 'destructive'}>{formatStatusLabel(curStatus)}</Badge></td>
                    <td className="max-w-[260px] truncate" title={nu}>{nu}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
                    <td>{approval ? new Date(approval).toLocaleString() : '-'}</td>
                    <td>{expiry ? new Date(expiry).toLocaleDateString() : '-'}</td>
                    <td>
                      <select defaultValue={(curStatus || '').toLowerCase()} onChange={(e) => handleUpdate(r.id, r.running_strategy_id, e.target.value)} className="px-3 py-2 rounded border border-[#283046] bg-[#0f1527]">
                        <option value="in-process">In-Process</option>
                        <option value="wrong-account-password">Wrong-Password</option>
                        <option value="wrong-account-id">Wrong-Account-ID</option>
                        <option value="wrong-account-server-name">Wrong-Account-Server-Name</option>
                        <option value="running">Running</option>
                        <option value="disconnected">Disconnected</option>
                      </select>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}