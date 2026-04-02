"use client";

import React, { useEffect, useState } from 'react';

const AllSettlementsPage = () => {
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/settlements', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch settlements');
        }
        setSettlements(Array.isArray(data.settlements) ? data.settlements : []);
        setError(null);
      } catch (e: any) {
        setError(e.message || 'Error fetching settlements');
        setSettlements([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) return <div className="p-6">Loading settlements...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">All Settlements</h1>
      <p className="text-sm text-gray-600 mb-4">Showing historical settlement records for all users and strategies.</p>

      <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2">User ID</th>
              <th className="px-3 py-2">User Name</th>
              <th className="px-3 py-2">Strategy ID</th>
              <th className="px-3 py-2">Invested</th>
              <th className="px-3 py-2">Gross Profit</th>
              <th className="px-3 py-2">Swap</th>
              <th className="px-3 py-2">Commission</th>
              <th className="px-3 py-2">Withdrawal</th>
              <th className="px-3 py-2">Settled Balance</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">End</th>
              <th className="px-3 py-2">Created At</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((settlement) => (
              <tr key={settlement.id ?? `${settlement.user_id}-${settlement.settlement_id}-${settlement.strategy_id}`}> 
                <td className="border-t px-3 py-2">{settlement.user_id}</td>
                <td className="border-t px-3 py-2">{settlement.user_name || settlement.userName || 'Unknown'}</td>
                <td className="border-t px-3 py-2">{settlement.strategy_id || settlement.strategyId}</td>
                <td className="border-t px-3 py-2">{Number(settlement.invested_amount || settlement.investedAmount || 0).toFixed(2)}</td>
                <td className="border-t px-3 py-2">{Number(settlement.gross_profit || settlement.grossProfit || 0).toFixed(2)}</td>
                <td className="border-t px-3 py-2">{Number(settlement.swap_amount || settlement.swapAmount || 0).toFixed(2)}</td>
                <td className="border-t px-3 py-2">{Number(settlement.commission_amount || settlement.commissionAmount || 0).toFixed(2)}</td>
                <td className="border-t px-3 py-2">{Number(settlement.withdrawal_amount || settlement.withdrawalAmount || 0).toFixed(2)}</td>
                <td className="border-t px-3 py-2">{Number(settlement.settled_balance || settlement.settledBalance || 0).toFixed(2)}</td>
                <td className="border-t px-3 py-2">{settlement.settlementStart || settlement.settlement_start || '-'}</td>
                <td className="border-t px-3 py-2">{settlement.settlementEnd || settlement.settlement_end || '-'}</td>
                <td className="border-t px-3 py-2">{settlement.createdAt || settlement.created_at || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AllSettlementsPage;
