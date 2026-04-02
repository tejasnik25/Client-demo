'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';

type StopMod = {
  id: string;
  running_strategy_id: string;
  user_id: string;
  user_name: string;
  strategy_name: string;
  current_balance: number;
  status: string;
  new_update_json: any;
  created_at: string;
};

export default function StopCopyingRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<StopMod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || (session?.user as any)?.role !== 'ADMIN') {
      router.push('/admin-login');
      return;
    }

    const loadRequests = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/running-strategies/modifications', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load stop-copy requests');

        const pendingDisconnects = (data.modifications || []).filter((mod: any) => {
          const req = typeof mod.new_update_json === 'string' ? JSON.parse(mod.new_update_json || '{}') : mod.new_update_json;
          return req?.action === 'disconnect' && String(mod.status || '').toLowerCase() === 'in-process';
        }).map((mod: any) => ({
          ...mod,
          current_balance: Number(mod.current_balance || 0),
          user_name: mod.user_name || '',
          strategy_name: mod.strategy_name || ''
        })) as StopMod[];

        setRows(pendingDisconnects);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Unable to load stop-copy requests');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [status, session, router]);

  const handleStop = async (mod: StopMod) => {
    if (!mod?.running_strategy_id) return;
    setActionInProgress(prev => ({ ...prev, [mod.id]: true }));
    try {
      const res = await fetch(`/api/admin/running-strategies/${mod.running_strategy_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'disconnected', modId: mod.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to stop copying');
      setRows(prev => prev.filter(r => r.id !== mod.id));
    } catch (err: any) {
      console.error('Stop copying action failed:', err);
      setError(err.message || 'Stop copying action failed');
    } finally {
      setActionInProgress(prev => ({ ...prev, [mod.id]: false }));
    }
  };

  if (loading) return <div className="p-6">Loading stop-copying requests...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="text-blue-500 hover:underline">Back</Link>
          <h1 className="text-2xl font-bold mt-2">Stop Copying Requests</h1>
          <p className="text-sm text-gray-500">Showing user-stop requests pending admin approval.</p>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded shadow ring-1 ring-black/5 p-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="text-left p-2">User ID</th>
              <th className="text-left p-2">User Name</th>
              <th className="text-left p-2">Strategy</th>
              <th className="text-left p-2">Current Balance</th>
              <th className="text-left p-2">Submitted Date</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-gray-500">No stop-copying requests found.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="p-2">{r.user_id}</td>
                  <td className="p-2">{r.user_name}</td>
                  <td className="p-2">{r.strategy_name}</td>
                  <td className="p-2">{r.current_balance.toFixed(2)}</td>
                  <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2"><Badge variant="warning">In-Process</Badge></td>
                  <td className="p-2">
                    <button
                      onClick={() => handleStop(r)}
                      disabled={Boolean(actionInProgress[r.id])}
                      className={`px-3 py-1 rounded text-white ${actionInProgress[r.id] ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                      {actionInProgress[r.id] ? 'Stopping...' : 'Stop'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
