// app/strategies/page.tsx
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import Tabs, { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import UserLayout from '@/components/UserLayout';
import { FiInfo, FiPlay } from 'react-icons/fi';
import { useAuth } from '@/hooks/use-auth';

interface Strategy {
  id: string;
  name: string;
  description: string;
  performance: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  category: 'Growth' | 'Income' | 'Momentum' | 'Value';
  imageUrl: string;
  details: string;
  parameters: Record<string, string>;
  contentType?: 'html' | 'pdf';
  contentUrl?: string;
  enabled?: boolean;
}

const StrategiesPage: React.FC = () => {
  const { data: session } = useSession();
  const { user } = useAuth();
  const router = useRouter();
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'Premium' | 'Expert' | 'Pro' | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [topTab, setTopTab] = useState<'explore' | 'deployed'>('explore');
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [txs, setTxs] = useState<any[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/strategies');
        if (!res.ok) throw new Error();
        const data = await res.json();
        const enabled = (data.strategies || []).filter((s: Strategy) => s.enabled !== false);
        setStrategies(enabled);
      } catch {
        setStrategies([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStrategies();
  }, []);

  // Fetch user transactions for deployed strategies view
  useEffect(() => {
    const fetchTxs = async () => {
      try {
        setLoadingTxs(true);
        const res = await fetch('/api/wallet/transactions');
        const data = await res.json();
        setTxs(data?.transactions || []);
      } catch {
        setTxs([]);
      } finally {
        setLoadingTxs(false);
      }
    };
    fetchTxs();
  }, []);

  const stratById = useMemo(() => {
    const map = new Map<string, Strategy>();
    strategies.forEach(s => map.set(s.id, s as any));
    return map;
  }, [strategies]);

  const approvedMine = useMemo(() => {
    if (!user) return [] as any[];
    return txs.filter((t: any) => t.user_id === user.id && t.status === 'completed' && t.strategy_id);
  }, [txs, user]);

  const handleViewInfo = (s: Strategy) => {
    if (!session) return router.push('/login?redirect=/strategies');
    setSelectedStrategy(s);
  };

  const handleDeploy = (s: Strategy) => {
    if (!session) return router.push('/login?redirect=/strategies');
    setSelectedStrategy(s);
    setPlanDialogOpen(true);
  };

  const getPlanPrices = (s: Strategy | null) => {
    if (!s) return { Premium: 5000, Expert: 10000, Pro: 20000 };
    const params = s.parameters || {} as Record<string, string>;
    const parseNum = (v?: string) => {
      const n = v ? parseFloat(v) : NaN;
      return isNaN(n) ? undefined : n;
    };
    const premium = parseNum(params['premium_price']);
    const expert = parseNum(params['expert_price']);
    const pro = parseNum(params['pro_price']);
    return {
      Premium: premium ?? 5000,
      Expert: expert ?? 10000,
      Pro: pro ?? 20000,
    };
  };

  const confirmPlanAndRedirect = () => {
    if (!selectedStrategy || !selectedPlan) return;
    const prices = getPlanPrices(selectedStrategy);
    const amount = prices[selectedPlan];
    const planParam = selectedPlan.toLowerCase();
    router.push(`/payment/method?strategyId=${encodeURIComponent(selectedStrategy.id)}&plan=${encodeURIComponent(planParam)}&amount=${encodeURIComponent(amount)}`);
  };

  const filtered = activeTab === 'all'
    ? strategies
    : strategies.filter(s => s.category.toLowerCase() === activeTab);

  return (
    <UserLayout>
    <div className="min-h-screen bg-[#0f1527] text-white">
      {/* Header */}
      <div className="border-b border-[#1f243a] px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold">Explore Strategies</h3>
            <p className="text-sm text-gray-400 mt-1">Browse and deploy FusionX-style trading strategies.</p>
          </div>
          <Button className="bg-[#00cfe8] text-black hover:bg-[#00bcd4]">Complete Now</Button>
        </div>
        {/* Progress Steps */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          {[
            { label: 'Sign up', done: true },
            { label: 'Complete KYC', done: false },
            { label: 'Connect a broker', done: false },
            { label: 'Deploy a strategy', done: false },
          ].map((step, idx) => (
            <div key={step.label} className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${step.done ? 'bg-[#28c76f] border-[#28c76f] text-black' : 'bg-[#1a1f2e] border-[#283046] text-gray-300'}`}>{idx + 1}</span>
              <span className={`font-medium ${step.done ? 'text-white' : 'text-gray-300'}`}>{step.label}</span>
              {idx < 3 && <span className="mx-1 text-[#283046]">—</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className="px-6 py-5 space-y-5">
        {/* Top Tabs */}
        <div className="flex gap-3">
          <button
            onClick={() => setTopTab('explore')}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              topTab === 'explore'
                ? 'bg-gradient-to-r from-[#7c3aed] to-[#a855f7] text-white shadow-lg'
                : 'bg-[#1a1f2e] text-gray-400 hover:bg-[#1f243a]'
            }`}
          >
            Explore Strategies
          </button>
          <button
            onClick={() => setTopTab('deployed')}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              topTab === 'deployed'
                ? 'bg-gradient-to-r from-[#7c3aed] to-[#a855f7] text-white shadow-lg'
                : 'bg-[#1a1f2e] text-gray-400 hover:bg-[#1f243a]'
            }`}
          >
            Deployed Strategies
          </button>
        </div>

        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full bg-[#1a1f2e] p-1 rounded-xl h-11">
            {['all', 'growth', 'value', 'income'].map(cat => (
              <TabsTrigger
                key={cat}
                value={cat}
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#7c3aed] data-[state=active]:to-[#a855f7] data-[state=active]:text-white rounded-lg text-sm font-medium capitalize"
              >
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Filter chips */}
        <div className="flex gap-2">
          {['Premium', 'Expert', 'Pro'].map((chip) => (
            <button key={chip} className="px-3 py-1.5 rounded-full text-xs bg-[#1a1f2e] border border-[#283046] text-gray-300 hover:border-[#7367f0] hover:text-white">
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Strategy Cards - Full Width */}
      <div className="px-6 pb-10 space-y-4">
        {topTab === 'deployed' ? (
          loadingTxs ? (
            <div className="text-gray-400">Loading...</div>
          ) : approvedMine.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-[#1a1f2e] rounded-2xl border border-[#283046]">
              <div className="flex items-center justify-center mb-4">
                <Image src="/file.svg" alt="No Data" width={64} height={64} />
              </div>
              <div className="text-sm">No deployed strategies yet.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {approvedMine.map((tx: any) => {
                const s = tx.strategy_id ? stratById.get(tx.strategy_id) : undefined;
                if (!s) return null;
                return (
                  <div key={tx.id} className="group bg-gradient-to-r from-[#1a1f2e] to-[#161d31] rounded-2xl p-6 border border-[#283046]">
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
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              s.riskLevel === 'High' ? 'bg-red-900/30 text-red-300' :
                              s.riskLevel === 'Medium' ? 'bg-yellow-900/30 text-yellow-300' :
                              'bg-green-900/30 text-green-300'
                            }`}>
                              {s.riskLevel}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-gray-400">{s.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-8 text-sm">
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
          )
        ) : loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-[#1a1f2e] rounded-2xl p-6 space-y-3">
              <div className="h-6 bg-[#283046] rounded w-1/3" />
              <div className="h-4 bg-[#283046] rounded w-1/2" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500 bg-[#1a1f2e] rounded-2xl">
            No strategies found.
          </div>
        ) : (
          filtered.map(strategy => (
            <div
              key={strategy.id}
              className="group bg-gradient-to-r from-[#1a1f2e] to-[#161d31] rounded-2xl p-6 border border-[#283046] hover:border-[#a855f7]/50 transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                {/* Left */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#7c3aed] to-[#a855f7] rounded-xl flex items-center justify-center p-2">
                    <div className="w-8 h-8 bg-white/20 rounded" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-semibold">{strategy.name}</h4>
                      <span className="text-xs text-gray-500">by Fusion</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs px-2 py-1 bg-[#283046] rounded-full uppercase">{strategy.category}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        strategy.riskLevel === 'High' ? 'bg-red-900/30 text-red-300' :
                        strategy.riskLevel === 'Medium' ? 'bg-yellow-900/30 text-yellow-300' :
                        'bg-green-900/30 text-green-300'
                      }`}>
                        {strategy.riskLevel}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-400">{strategy.description}</p>
                  </div>
                </div>

                {/* Center */}
                <div className="flex gap-8 text-sm">
                  <div>
                    <div className="text-gray-500">Performance</div>
                    <div className="font-bold text-white">{strategy.performance}%</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Risk Level</div>
                    <div className="font-bold text-white">{strategy.riskLevel}</div>
                  </div>
                </div>

                {/* Right */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#a855f7] text-[#a855f7] hover:bg-[#a855f7] hover:text-white"
                    onClick={() => handleViewInfo(strategy)}
                  >
                    <FiInfo className="mr-2 h-4 w-4" />
                    Info
                  </Button>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:from-[#6d28d9] hover:to-[#9333ea]"
                    onClick={() => handleDeploy(strategy)}
                  >
                    <FiPlay className="mr-2 h-4 w-4" />
                    Deploy
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dialog */}
      <Dialog open={!!selectedStrategy} onOpenChange={o => !o && setSelectedStrategy(null)}>
        <DialogContent className="max-w-4xl bg-[#161d31] text-white border-[#283046]">
          {selectedStrategy && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedStrategy.name}</DialogTitle>
                <DialogDescription className="text-gray-400">{selectedStrategy.description}</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-6">
                <div className="h-48 bg-gradient-to-br from-[#7c3aed]/20 to-transparent rounded-xl flex items-center justify-center">
                  <div className="text-6xl font-bold text-[#a855f7]/50">FX</div>
                </div>
                <p>{selectedStrategy.details}</p>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Parameters</h4>
                    {Object.entries(selectedStrategy.parameters).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-1 text-sm">
                        <span className="text-gray-400">{k}:</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Stats</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-gray-400">Performance:</span> <span>{selectedStrategy.performance}%</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Risk:</span> <span>{selectedStrategy.riskLevel}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Category:</span> <span>{selectedStrategy.category}</span></div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button className="bg-gradient-to-r from-[#7c3aed] to-[#a855f7]" onClick={() => handleDeploy(selectedStrategy)}>
                  <FiPlay className="mr-2" /> Deploy Strategy
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Plan Selection Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={(o) => setPlanDialogOpen(o)}>
        <DialogContent className="max-w-lg bg-[#161d31] text-white border-[#283046]">
          <DialogHeader>
            <DialogTitle className="text-xl">Select a Plan</DialogTitle>
            <DialogDescription className="text-gray-400">Choose Premium, Expert, or Pro to continue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(['Premium','Expert','Pro'] as const).map((plan) => {
              const prices = getPlanPrices(selectedStrategy);
              const amt = prices[plan];
              const active = selectedPlan === plan;
              return (
                <button
                  key={plan}
                  onClick={() => setSelectedPlan(plan)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition ${active ? 'border-[#a855f7] bg-[#1a1f2e]' : 'border-[#283046] bg-[#161d31] hover:bg-[#1a1f2e]'}`}
                >
                  <span className="font-medium">{plan}</span>
                  <span className="text-sm text-gray-300">₹ {amt.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              disabled={!selectedPlan}
              className={`px-4 py-2 rounded-lg ${selectedPlan ? 'bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:from-[#6d28d9] hover:to-[#9333ea]' : 'bg-gray-600 cursor-not-allowed'}`}
              onClick={confirmPlanAndRedirect}
            >
              Continue to Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </UserLayout>
  );
};

export default StrategiesPage;

