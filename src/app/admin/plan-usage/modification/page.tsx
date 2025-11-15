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
          fetch('/api/admin/running-strategies/modifications'),
          fetch('/api/admin/running-strategies'),
          fetch('/api/admin/payments/approved'),
        ]);
        const modsData = await modsRes.json();
        const runsData = await runsRes.json();
        const aprData = await aprRes.json().catch(() => []);
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
        }));
        setRows(list);
        const map: Record<string, any> = {};
        (runsData.strategies || []).forEach((r: any) => { map[r.id] = r; });
        setRunMap(map);
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
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Update failed');
      const data = await fetch('/api/admin/running-strategies/modifications').then(r => r.json());
      setRows((data.modifications || []).map((m: any) => ({
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
      })));
    } catch (e) {
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <Link href="/admin" className="mr-4">Back</Link>
        <h1 className="text-2xl font-bold">Plan Usage Modifications</h1>
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
            {rows.length === 0 ? (
              <tr><td colSpan={13} className="empty-3d text-center py-6">No modifications</td></tr>
            ) : (
              rows.map((r) => {
                const info = runMap[r.running_strategy_id] || {};
                const name = info.userName || '-';
                const strat = info.strategyName || '-';
                const nu = r.new_update_json ? JSON.stringify(r.new_update_json) : '-';
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
                    <td><Badge variant={curStatus === 'running' ? 'success' : curStatus === 'in-process' ? 'warning' : 'destructive'}>{curStatus}</Badge></td>
                    <td className="max-w-[260px] truncate" title={nu}>{nu}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
                    <td>{approval ? new Date(approval).toLocaleString() : '-'}</td>
                    <td>{expiry ? new Date(expiry).toLocaleDateString() : '-'}</td>
                    <td>
                      <select defaultValue={curStatus} onChange={(e) => handleUpdate(r.id, r.running_strategy_id, e.target.value)} className="px-3 py-2 rounded border border-[#283046] bg-[#0f1527]">
                        <option value="in-process">In-Process</option>
                        <option value="wrong-account-password">Wrong-Password</option>
                        <option value="wrong-account-id">Wrong-Account-ID</option>
                        <option value="wrong-account-server-name">Wrong-Account-Server-Name</option>
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