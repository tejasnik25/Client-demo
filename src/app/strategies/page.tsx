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
import { FiInfo, FiPlay, FiX } from 'react-icons/fi';
import { Strategy } from "@/types/strategy";
import { useAuth } from '@/hooks/use-auth';

const StrategiesPage: React.FC = () => {
  const { data: session } = useSession();
  const { user } = useAuth();
  const router = useRouter();
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  // Separate state so Info dialog does NOT auto-open on deploy
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
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
    router.push(`/strategies/${s.id}/info`);
  };

  const handleDeploy = (s: Strategy) => {
    if (!session) return router.push('/login?redirect=/strategies');
    setSelectedStrategy(s);
    // Ensure only plans are shown; keep info dialog closed
    setInfoDialogOpen(false);
    setPlanDialogOpen(true);
  };

  const getPlanPrices = (s: Strategy | null) => {
    if (!s) return { Premium: 5000, Expert: 10000, Pro: 20000 };
    
    // Use new planPrices field if available, otherwise fallback to parameters
    if (s.planPrices) {
      return {
        Premium: s.planPrices.Premium ?? 5000,
        Expert: s.planPrices.Expert ?? 10000,
        Pro: s.planPrices.Pro ?? 20000,
      };
    }
    
    // Fallback to old parameters method for backward compatibility
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

  // Display user-facing range labels per plan in the deploy dialog
  const getPlanDisplayRange = (plan: 'Premium' | 'Expert' | 'Pro'): string => {
    const s = selectedStrategy;
    const label = s?.planDetails?.[plan]?.priceLabel;
    if (label && label.trim().length > 0) return label;
    if (plan === 'Premium') return '$6000+';
    if (plan === 'Expert') return '$3000-$5999';
    return '$1000-$2999';
  };

  const getPlanPercent = (plan: 'Premium' | 'Expert' | 'Pro'): number => {
    const s = selectedStrategy;
    const pct = s?.planDetails?.[plan]?.percent;
    if (typeof pct === 'number' && !isNaN(pct)) return pct;
    if (plan === 'Premium') return 12;
    if (plan === 'Expert') return 15;
    return 17;
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
    : strategies.filter(s => s.category?.toLowerCase() === activeTab);

  return (
    <UserLayout>
    <div className="min-h-screen bg-[#0f1527] text-white">
      {/* Header */}
      <div className="border-b border-[#1f243a] px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold">Explore Strategies</h3>
            <p className="text-sm text-gray-400 mt-1">Browse and deploy Copy-Trade-style trading strategies.</p>
          </div>
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
                            {s.tag && (
                              <span className="text-xs px-2 py-1 bg-[#7c3aed] text-white rounded-full">{s.tag}</span>
                            )}
                            {/* Fallback to deprecated fields if new ones aren't available */}
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
                      <div className="flex gap-8 text-sm">
                        {/* Display new metrics if available, otherwise fallback to deprecated ones */}
                        {s.minCapital !== undefined ? (
                          <div>
                            <div className="text-gray-500">Min Capital</div>
                            <div className="font-bold text-white">₹{s.minCapital.toLocaleString()}</div>
                          </div>
                        ) : s.performance !== undefined ? (
                          <div>
                            <div className="text-gray-500">Performance</div>
                            <div className="font-bold text-white">{s.performance}%</div>
                          </div>
                        ) : null}
                        
                        {s.avgDrawdown !== undefined ? (
                          <div>
                            <div className="text-gray-500">Avg Drawdown</div>
                            <div className="font-bold text-white">{s.avgDrawdown}%</div>
                          </div>
                        ) : s.riskLevel ? (
                          <div>
                            <div className="text-gray-500">Risk Level</div>
                            <div className="font-bold text-white">{s.riskLevel}</div>
                          </div>
                        ) : null}
                        
                        {s.riskReward !== undefined && (
                          <div>
                            <div className="text-gray-500">Risk Reward</div>
                            <div className="font-bold text-white">{s.riskReward}</div>
                          </div>
                        )}
                        
                        {s.winStreak !== undefined && (
                          <div>
                            <div className="text-gray-500">Win Streak</div>
                            <div className="font-bold text-white">{s.winStreak}</div>
                          </div>
                        )}
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
              className="group fx-3d-card bg-gradient-to-r from-[#1a1f2e] to-[#161d31] rounded-2xl p-6 border border-[#283046] hover:border-[#a855f7]/50 transition-all"
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
                    {strategy.tag && (
                        <span className="text-xs px-2 py-1 bg-[#7c3aed] text-white rounded-full whitespace-nowrap">{strategy.tag}</span>
                      )}
                      {/* Fallback to deprecated fields if new ones aren't available */}
                      {strategy.category && (
                        <span className="text-xs px-2 py-1 bg-[#283046] rounded-full uppercase whitespace-nowrap">{strategy.category}</span>
                      )}
                      {strategy.riskLevel && (
                        <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                          strategy.riskLevel === 'High' ? 'bg-red-900/30 text-red-300' :
                          strategy.riskLevel === 'Medium' ? 'bg-yellow-900/30 text-yellow-300' :
                          'bg-green-900/30 text-green-300'
                        }`}>
                          {strategy.riskLevel}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-base md:text-sm leading-6 text-gray-400">{strategy.description}</p>
                  </div>
                </div>

                {/* Center */}
                <div className="text-sm grid grid-cols-2 gap-4 w-full md:w-auto md:flex md:gap-8">
                  {/* Display new metrics if available, otherwise fallback to deprecated ones */}
                  {strategy.minCapital !== undefined ? (
                    <div>
                      <div className="text-gray-500">Min Capital</div>
                      <div className="font-bold text-white">₹{strategy.minCapital.toLocaleString()}</div>
                    </div>
                  ) : strategy.performance !== undefined ? (
                    <div>
                      <div className="text-gray-500">Performance</div>
                      <div className="font-bold text-white">{strategy.performance}%</div>
                    </div>
                  ) : null}
                  
                  {strategy.avgDrawdown !== undefined ? (
                    <div>
                      <div className="text-gray-500">Avg Drawdown</div>
                      <div className="font-bold text-white">{strategy.avgDrawdown}%</div>
                    </div>
                  ) : strategy.riskLevel ? (
                    <div>
                      <div className="text-gray-500">Risk Level</div>
                      <div className="font-bold text-white">{strategy.riskLevel}</div>
                    </div>
                  ) : null}
                  
                  {strategy.riskReward !== undefined && (
                    <div>
                      <div className="text-gray-500">Risk Reward</div>
                      <div className="font-bold text-white">{strategy.riskReward}</div>
                    </div>
                  )}
                  
                  {strategy.winStreak !== undefined && (
                    <div>
                      <div className="text-gray-500">Win Streak</div>
                      <div className="font-bold text-white">{strategy.winStreak}</div>
                    </div>
                  )}
                </div>

                {/* Right */}
                <div className="grid grid-cols-1 gap-3 w-full md:w-auto md:flex md:gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 w-full md:w-auto border-[#a855f7] text-[#a855f7] hover:bg-[#a855f7] hover:text-white"
                    onClick={() => handleViewInfo(strategy)}
                  >
                    Info
                  </Button>
                  <Button
                    size="sm"
                    className="h-11 w-full md:w-auto bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:from-[#6d28d9] hover:to-[#9333ea]"
                    onClick={() => handleDeploy(strategy)}
                  >
                    Deploy
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Dialog (kept, but controlled independently so deploy won't open it) */}
      <Dialog open={infoDialogOpen} onOpenChange={(o) => setInfoDialogOpen(o)}>
        <DialogContent className="max-w-4xl bg-[#161d31] text-white border-[#283046]">
          {selectedStrategy && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedStrategy.name}</DialogTitle>
                <DialogDescription className="text-gray-400">{selectedStrategy.description}</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-6">
                {/* FusionX-style info content container */}
                <div className="rounded-xl border border-white/10 bg-[#0f172a] p-3">
                  {selectedStrategy.contentUrl ? (
                    selectedStrategy.contentType === 'pdf' ? (
                      <object
                        data={selectedStrategy.contentUrl}
                        type="application/pdf"
                        className="w-full h-[70vh]"
                      >
                        <iframe
                          src={selectedStrategy.contentUrl}
                          className="w-full h-full"
                        />
                      </object>
                    ) : (
                      <iframe
                        src={selectedStrategy.contentUrl}
                        className="w-full h-[70vh] rounded-lg"
                      />
                    )
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-[#7c3aed]/20 to-transparent rounded-xl flex items-center justify-center">
                      <div className="text-sm text-gray-400">No info document available</div>
                    </div>
                  )}
                </div>

                {/* Optional details below the embedded content */}
                {selectedStrategy.details && (
                  <p className="text-sm text-gray-300">{selectedStrategy.details}</p>
                )}
              </div>
              <DialogFooter>
                <Button className="bg-gradient-to-r from-[#7c3aed] to-[#a855f7]" onClick={() => handleDeploy(selectedStrategy)}>
                  <FiPlay className="mr-2 fx-3d-icon" /> Deploy Strategy
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Plan Selection Dialog - Full Overlay */}
      <Dialog open={planDialogOpen} onOpenChange={(o) => setPlanDialogOpen(o)}>
        <DialogContent className="max-w-md bg-gray-900 text-white border-gray-700 shadow-2xl">
          {/* Custom Overlay with 100% opacity */}
          <div className="fixed inset-0 z-40 bg-black" />
          
          <div className="relative z-50">
            <DialogHeader>
              <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                <DialogTitle className="text-xl font-bold text-white">Select a Plan</DialogTitle>
                <button 
                  onClick={() => setPlanDialogOpen(false)}
                  className="text-gray-400 hover:text-white text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <DialogDescription className="mt-4 text-gray-400">
                Choose Premium, Expert, or Pro to continue.
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-6 space-y-4">
              {(['Premium','Expert','Pro'] as const).map((plan) => {
                const rangeLabel = getPlanDisplayRange(plan);
                const active = selectedPlan === plan;
                const descriptions = {
                  Premium: 'Basic access with standard features.',
                  Expert: 'Advanced features with priority support.',
                  Pro: 'Full access with premium analytics.'
                };
                
                return (
                  <div
                    key={plan}
                    onClick={() => setSelectedPlan(plan)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      active 
                        ? 'border-purple-500 bg-purple-900/20' 
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white text-lg">{plan}</h3>
                        <p className="text-sm text-gray-400 mt-1">{descriptions[plan]}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-teal-400">{rangeLabel}</p>
                        <p className="text-xs text-gray-400 mt-1">{getPlanPercent(plan)}% of your capital for 1 year</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="mt-6">
              <button
                disabled={!selectedPlan}
                onClick={confirmPlanAndRedirect}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  selectedPlan 
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white' 
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                Continue to Payment
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </UserLayout>
  );
};

export default StrategiesPage;


