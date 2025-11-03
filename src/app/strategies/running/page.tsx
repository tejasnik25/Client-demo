"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import UserLayout from "@/components/UserLayout";
import { useAuth } from "@/hooks/use-auth";

type Tx = {
  id: string;
  user_id: string;
  status: 'pending' | 'completed' | 'failed';
  strategy_id?: string;
  plan_level?: 'Premium' | 'Expert' | 'Pro';
};

type Strategy = {
  id: string;
  name: string;
  description: string;
  performance: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  category: 'Growth' | 'Income' | 'Momentum' | 'Value';
  imageUrl: string;
};

const RunningStrategiesPage: React.FC = () => {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [txRes, stratRes] = await Promise.all([
          fetch('/api/wallet/transactions'),
          fetch('/api/strategies'),
        ]);
        const txData = await txRes.json();
        const stratData = await stratRes.json();
        setTxs(txData?.transactions || []);
        setStrategies((stratData?.strategies || []).filter((s: any) => s.enabled !== false));
      } catch {
        setTxs([]);
        setStrategies([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const approvedMine = useMemo(() => {
    if (!user) return [] as Tx[];
    return txs.filter(t => t.user_id === user.id && t.status === 'completed' && t.strategy_id);
  }, [txs, user]);

  const stratById = useMemo(() => {
    const map = new Map<string, Strategy>();
    strategies.forEach(s => map.set(s.id, s as any));
    return map;
  }, [strategies]);

  return (
    <UserLayout>
      <div className="min-h-screen bg-[#0f1527] text-white px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Running Strategy</h1>
            <p className="text-sm text-gray-400">Approved and active strategies</p>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : approvedMine.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-[#1a1f2e] rounded-2xl border border-[#283046]">
            <div className="flex items-center justify-center mb-4">
              <Image src="/file.svg" alt="No Data" width={64} height={64} />
            </div>
            <div className="text-sm">No approved running strategies yet.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {approvedMine.map(tx => {
              const s = tx.strategy_id ? stratById.get(tx.strategy_id) : undefined;
              if (!s) return null;
              return (
                <div key={tx.id} className="group fx-3d-card bg-gradient-to-r from-[#1a1f2e] to-[#161d31] rounded-2xl p-6 border border-[#283046]">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-14 h-14 bg-gradient-to-br from-[#7c3aed] to-[#a855f7] rounded-xl flex items-center justify-center p-2">
                        <div className="w-8 h-8 bg-white/20 rounded" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-semibold">{s.name}</h4>
                          <span className="text-xs text-gray-500">Plan: {tx.plan_level ?? '—'}</span>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <span className="text-xs px-2 py-1 bg-[#283046] rounded-full uppercase">{s.category}</span>
                          <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                            s.riskLevel === 'High' ? 'bg-red-900/30 text-red-300' :
                            s.riskLevel === 'Medium' ? 'bg-yellow-900/30 text-yellow-300' :
                            'bg-green-900/30 text-green-300'
                          }`}>
                            {s.riskLevel}
                          </span>
                        </div>
                        <p className="mt-2 text-base md:text-sm leading-6 text-gray-400">{s.description}</p>
                      </div>
                    </div>
                    <div className="text-sm grid grid-cols-2 gap-4 w-full md:w-auto md:flex md:gap-8">
                      <div>
                        <div className="text-gray-500">Performance</div>
                        <div className="font-bold text-white">{s.performance}%</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Risk Level</div>
                        <div className="font-bold text-white">{s.riskLevel}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </UserLayout>
  );
};

export default RunningStrategiesPage;