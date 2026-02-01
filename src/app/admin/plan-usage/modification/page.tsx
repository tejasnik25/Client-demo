'use client';
import { useEffect, useState, useRef } from 'react';
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
  const [requestFilter, setRequestFilter] = useState<string>('');

  const hasLoadedRef = useRef(false);
  const [selectedActions, setSelectedActions] = useState<Record<string, string>>({});

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
    if (u.action && String(u.action).toLowerCase() === 'enable') parts.push('Request to enable the strategy');
    if (u.action && String(u.action).toLowerCase() === 'disconnect') parts.push('Request to disconnect strategy');
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
    if (hasLoadedRef.current) return;
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
          // Exclude modifications that correspond to runs that are already running
          return cur !== 'running';
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
    hasLoadedRef.current = true;
  }, [status, session, router]);

  const handleUpdate = async (_id: string, rsId: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/running-strategies/${rsId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, modId: _id }),
      });
      if (!res.ok) throw new Error('Update failed');
      if (status === 'running' || status === 'disconnected') {
        const updated = rows.filter(r => r.id !== _id);
        setRows(updated);
        setSelectedActions(prev => { const newPrev = { ...prev }; delete newPrev[_id]; return newPrev; });
      }
      const remaining = (status === 'running' || status === 'disconnected') ? 0 : 1; // dummy
      const nextStatus = (status === 'running' || status === 'disconnected') && remaining > 0 ? 'in-process' : status;
      setRunMap(prev => ({ ...(prev || {}), [rsId]: { ...(prev?.[rsId] || {}), adminStatus: nextStatus } }));
    } catch (e) {
      console.error('update failed', e);
    }
  };

  useEffect(() => {
    const initial: Record<string, string> = {};
    rows.forEach(r => {
      initial[r.id] = '';
    });
    setSelectedActions(initial);
  }, [rows]);

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
    const matchesRequest = !requestFilter || actionFromNew === requestFilter || curStatus === requestFilter;
    return matchesSearch && matchesPlan && matchesPlatform && matchesStatus && matchesRequest;
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
            className="w-full px-3 py-2 rounded bg-white border border-gray-200 text-gray-900"
          />
        </div>
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium mb-1">Plan</label>
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="w-full px-3 py-2 rounded bg-white border border-gray-200 text-gray-900">
            <option value="">All Plans</option>
            <option value="Pro">Pro</option>
            <option value="Expert">Expert</option>
            <option value="Premium">Premium</option>
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium mb-1">Platform</label>
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="w-full px-3 py-2 rounded bg-white border border-gray-200 text-gray-900">
            <option value="">All Platforms</option>
            <option value="MT4">MT4</option>
            <option value="MT5">MT5</option>
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium mb-1">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 rounded bg-white border border-gray-200 text-gray-900">
            <option value="">All Statuses</option>
            {uniqueStatuses.map(s => (
              <option key={s} value={s}>{formatStatusLabel(s)}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium mb-1">Request Type</label>
          <select value={requestFilter} onChange={(e) => setRequestFilter(e.target.value)} className="w-full px-3 py-2 rounded bg-white border border-gray-200 text-gray-900">
            <option value="">All Types</option>
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
              <th>Confirm Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={14} className="empty-3d text-center py-6">No modifications</td></tr>
            ) : (
              filteredRows.map((r) => {
                const info = runMap[r.running_strategy_id] || {};
                const name = info.userName || '-';
                const strat = info.strategyName || '-';
                const nu = r.new_update_json ? formatUpdateRequest(r.new_update_json) : '-';
                const req = (() => {
                  const raw = r.new_update_json;
                  if (!raw) return {} as any;
                  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {} as any; } }
                  return raw as any;
                })();
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
                    <td className="align-top">
                      <div className="text-green-500 text-xs">New: {(r.platform ?? req.platform) || '-'}</div>
                      <div className="mt-1 text-xs text-gray-400">Old: {info.platform || '-'}</div>
                    </td>
                    <td className="align-top">
                      <div className="text-green-500 text-xs">New: {(r.mt_account_id ?? req.mt_account_id) || '-'}</div>
                      <div className="mt-1 text-xs text-gray-400">Old: {info.mtAccountId || '-'}</div>
                    </td>
                    <td className="align-top">
                      <div className="text-green-500 text-xs">New: {(r.mt_account_password ?? req.mt_account_password) || '-'}</div>
                      <div className="mt-1 text-xs text-gray-400">Old: {info.mtAccountPassword || '-'}</div>
                    </td>
                    <td className="align-top">
                      <div className="text-green-500 text-xs">New: {(r.mt_account_server ?? req.mt_account_server) || '-'}</div>
                      <div className="mt-1 text-xs text-gray-400">Old: {info.mtAccountServer || '-'}</div>
                    </td>
                    <td><Badge variant={curStatus === 'running' ? 'success' : curStatus === 'in-process' ? 'warning' : 'destructive'}>{formatStatusLabel(curStatus)}</Badge></td>
                    <td className="max-w-[320px] align-top">
                      <div className="truncate text-gray-300" title={nu}>{nu}</div>
                      <div className="mt-1 text-[11px]">
                        <div className="text-gray-400">
                          {(() => {
                            const oldPlatform = info.platform || '-';
                            const oldId = info.mtAccountId || '-';
                            const oldPass = info.mtAccountPassword || '-';
                            const oldServer = info.mtAccountServer || '-';
                            return `Old: Platform ${oldPlatform}; Account ID ${oldId}; Password ${oldPass}; Server ${oldServer}`;
                          })()}
                        </div>
                        <div className="text-green-500">
                          {(() => {
                            const newPlatform = (r.platform ?? req.platform) || '-';
                            const newId = (r.mt_account_id ?? req.mt_account_id) || '-';
                            const newPass = (r.mt_account_password ?? req.mt_account_password) || '-';
                            const newServer = (r.mt_account_server ?? req.mt_account_server) || '-';
                            return `New: Platform ${newPlatform}; Account ID ${newId}; Password ${newPass}; Server ${newServer}`;
                          })()}
                        </div>
                      </div>
                    </td>
                    <td>{submission ? new Date(submission).toLocaleString('en-US') : '-'}</td>
                    <td title="Start date from payment acceptance">{approval ? new Date(approval).toLocaleString('en-US') : '-'}</td>
                    <td>{expiry ? new Date(expiry).toLocaleDateString('en-US') : '-'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const selected = selectedActions[r.id];
                            let statusToSet = selected;
                            if (selected === 'running') statusToSet = 'running';
                            else if (selected === 'disconnect') statusToSet = 'disconnected';
                            else statusToSet = selected;  // wrong-password etc.
                            handleUpdate(r.id, r.running_strategy_id, statusToSet);
                          }}
                          disabled={selectedActions[r.id] !== 'running' && selectedActions[r.id] !== 'disconnect'}
                          className={`px-3 py-2 rounded text-white ${selectedActions[r.id] === 'running' || selectedActions[r.id] === 'disconnect' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500 cursor-not-allowed'}`}
                          title="Accept changes and update details"
                        >
                          Apply Changes
                        </button>
                      </div>
                    </td>
                    <td>
                      <select
                        value={selectedActions[r.id] || ''}
                        onChange={(e) => setSelectedActions(prev => ({ ...prev, [r.id]: e.target.value }))}
                        className="px-2 py-1 rounded bg-[#0f1527] border border-[#283046] text-white text-xs"
                      >
                        <option value="">-Select option-</option>
                        <option value="wrong-platform">Wrong platform</option>
                        <option value="wrong-password">Wrong Password</option>
                        <option value="wrong-account-id">Wrong Account ID</option>
                        <option value="wrong-server">Wrong Server</option>
                        <option value="disconnect">Disconnect</option>
                        <option value="running">Running</option>
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
