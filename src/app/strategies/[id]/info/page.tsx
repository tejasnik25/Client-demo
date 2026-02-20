"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import Button from "@/components/ui/Button";
import {
  FiActivity,
  FiArrowLeft,
  FiHelpCircle,
  FiInfo,
  FiFacebook,
  FiTwitter,
  FiInstagram,
  FiYoutube,
  FiLinkedin,
  FiMail,
  FiPhone,
  FiMessageCircle,
} from "react-icons/fi";
import { Strategy } from "@/types/strategy";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const StrategyInfoPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'Premium' | 'Expert' | 'Pro' | null>(null);

  const [history, setHistory] = useState<any[]>([]);
  const [openPositions, setOpenPositions] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [connectAt, setConnectAt] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 10;

  // Removed auth redirect to allow public access to info page
  // useEffect(() => {
  //   if (status === "unauthenticated") {
  //     router.push(`/login?redirect=${encodeURIComponent(`/strategies/${params.id}/info`)}`);
  //   }
  // }, [status, router, params.id]);

  useEffect(() => {
    const fetchStrategy = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/strategies");
        const data = await res.json();
        const found = (data.strategies || []).find((s: Strategy) => s.id === params.id);
        if (!found) {
          setError("Strategy not found");
        } else {
          setStrategy(found);
        }
      } catch (e) {
        setError("Failed to load strategy");
      } finally {
        setLoading(false);
      }
    };
    fetchStrategy();
  }, [params.id]);

  useEffect(() => {
    if (params.id) {
      const fetchHistory = async () => {
        try {
          setHistoryLoading(true);
          const [res, runRes] = await Promise.all([
            fetch(`/api/strategies/${params.id}/master-history?t=${Date.now()}`, { cache: 'no-store' }),
            fetch(`/api/strategies/running`, { cache: 'no-store' })
          ]);
          const data = await res.json();
          if (data.history) {
            setHistory(data.history);
          }
          if (data.open_positions) {
            setOpenPositions(data.open_positions);
          }
          setHistoryError(data.error || null);
          const runData = await runRes.json().catch(() => null);
          const me = Array.isArray(runData?.strategies) ? runData.strategies.find((x: any) => x.strategyId === params.id) : null;
          setConnectAt(me?.createdAt || null);
        } catch (e) {
          console.error("Failed to fetch history:", e);
          setHistoryError('Failed to fetch master history');
        } finally {
          setHistoryLoading(false);
        }
      };
      fetchHistory();
    }
  }, [params.id]);

  const getPlanPrices = (s: Strategy | null) => {
    if (!s) return { Premium: 5000, Expert: 10000, Pro: 20000 };

    // Use new planPrices field if available, otherwise fallback to parameters
    if (s.planPrices) {
      return {
        Premium: s.planPrices.Premium || 5000,
        Expert: s.planPrices.Expert || 10000,
        Pro: s.planPrices.Pro || 20000
      };
    }

    // Fallback to parameters parsing (legacy)
    return { Premium: 5000, Expert: 10000, Pro: 20000 };
  };

  const getPlanDisplayRange = (plan: 'Premium' | 'Expert' | 'Pro') => {
    const prices = getPlanPrices(strategy);
    const price = prices[plan];
    const sym = String(strategy?.parameters?.currencySymbol || strategy?.parameters?.currency || '').trim();
    if (price >= 1000) {
      return `${sym || ''}${price.toLocaleString()}`;
    }
    return `${sym || ''}${price}`;
  };

  const getPlanPercent = (plan: 'Premium' | 'Expert' | 'Pro') => {
    if (!strategy?.planDetails?.[plan]?.percent) {
      // Default percentages
      const defaults = { Premium: 10, Expert: 15, Pro: 20 };
      return defaults[plan];
    }
    return strategy.planDetails[plan].percent;
  };

  const confirmPlanAndRedirect = () => {
    if (selectedPlan && strategy) {
      // Redirect to the payment page with the selected plan and strategy
      router.push(`/payment?strategy=${strategy.id}&plan=${selectedPlan}`);
    }
  };

  const handleSetupCopying = () => {
    if (!session || (session.user as any)?.role !== 'USER') {
      return router.push('/login?redirect=/strategies');
    }
    // Redirect directly to payment page - plan selection will be step 1
    router.push(`/payment?strategy=${params.id}`);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="bg-black border border-gray-200 rounded-xl p-6">
          <p className="text-red-600">{error || "Strategy not found"}</p>
          <div className="mt-4 text-white">
            <Button onClick={() => router.push("/strategies")}>Back to Strategies</Button>
          </div>
        </div>
      </div>
    );
  }

  const strategyParams = strategy.parameters || {};
  const equityVal = strategyParams.equity || strategyParams.Equity || "";
  const commissionVal = strategyParams.commission || strategyParams.Commission || "";
  const withUsVal = strategyParams.withUs || strategyParams.WithUs || strategyParams.withUsDays || strategyParams.WithUsDays || "";
  const chatLink = strategyParams.chatLink || strategyParams.telegram || strategyParams.Telegram || strategyParams.Chat || "";

  // Pagination logic for closed positions (filter by connect time)
  const filteredHistory = (() => {
    const startTs = connectAt ? new Date(connectAt).getTime() : 0;
    const parseTs = (h: any) => {
      const ts = h.time_close || h.server_time_close || h.time_open || h.server_time_open;
      const t = ts ? new Date(ts).getTime() : NaN;
      return Number.isFinite(t) ? t : 0;
    };
    return history.filter((h: any) => parseTs(h) >= startTs);
  })();
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const currentHistory = filteredHistory.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredHistory.length / entriesPerPage);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 relative overflow-x-hidden">
      {/* Ambient gradient glows for 3D feel */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-purple-600/10 blur-3xl" />
      <div className="pointer-events-none absolute top-20 -right-40 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />

      {/* Top Navigation (no sidebar) */}
      <header className="sticky top-0 z-50 h-24 px-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center">
          <Image 
            src="/Signals Copy - Logo.png" 
            alt="Signals Copy" 
            width={200} 
            height={80} 
            className="object-contain" 
            quality={100}
            priority
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="px-4 py-2 h-10 flex items-center justify-center text-white border-2 border-red-500 hover:bg-red-500 hover:text-white transition-all duration-200"
            aria-label="Back"
            title="Back"
            onClick={() => router.push("/strategies")}
          >Back
            {/* <FiArrowLeft className="h-2 w-2" /> */}
          </Button>
        </div>
      </header>

      {/* Info Content Section */}
      <main className="p-6">
        {/* Wider container for the embedded HTML/PDF */}
        <div className="mx-auto max-w-[1400px]">
          {/* Strategy Profile Card - OctaFX Style */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 p-6">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              {/* Profile Section */}
              <div className="flex items-start gap-4 flex-1">
                <div className="relative">
  {strategy.imageUrl ? (
    <img
      src={strategy.imageUrl}
      alt={strategy.name}
      className="w-20 h-20 rounded-full object-cover border border-gray-200 bg-gray-50"
    />
  ) : (
    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center border border-gray-200">
      <span className="text-white font-bold text-xl">
        {strategy.name?.charAt(0)?.toUpperCase() || 'S'}
      </span>
    </div>
  )}
  {(() => {
    const cc = String(strategy.parameters?.countryFlag || '').toLowerCase();
    const isCC = /^[a-z]{2}$/.test(cc);
    const url = isCC ? `https://flagcdn.com/24x18/${cc}.png` : '';
    return url ? (
      <img
        src={url}
        alt={cc}
        className="absolute -left-1 bottom-0 w-7 h-5 rounded-sm border border-white shadow-sm"
      />
    ) : null;
  })()}
</div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-2xl font-bold text-gray-900">{strategy.name}</h2>
                    {strategy.mastersTag && (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                        {strategy.mastersTag}
                      </span>
                    )}
                  </div>

                  {/* Status and Risk Badges (removed as requested) */}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-10  ">
                    {strategy.tag && (
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                        {strategy.tag}
                      </span>
                    )}
                    {/* {strategy.category && (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full uppercase">
                        {strategy.category}
                      </span>
                    )} */}
                  </div>

                  {/* SET UP COPYING Button */}
                  <div className="mt-4">
                    <button
                      className="h-12 px-8 rounded-full bg-green-600 text-white font-semibold w-full rounded-xl md:w-auto"
                      onClick={handleSetupCopying}
                    >
                      Set Up Copy
                    </button>
                    <div className="text-sm text-gray-600 mt-2">
                      Minimum investment: ${strategy.planPrices?.Pro || 50}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Metrics + Description */}
              <div className="flex-1 md:max-w-[640px]">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-8 text-l w-full md:w-auto">
                  <div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <span>Risk score</span>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <div className="cursor-help inline-flex items-center justify-center">
                              <FiHelpCircle className="w-3 h-3 text-gray-600" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent 
                            side="right" 
                            align="start"
                            className="z-50 bg-[#1a1d24] border-none text-white p-4 max-w-[280px] shadow-2xl rounded-xl"
                          >
                            <div className="space-y-3 font-sans">
                              <h4 className="font-bold text-[15px] text-white">Risk score</h4>
                              <p className="text-[11px] text-gray-300 leading-relaxed font-normal">
                                The higher it is, the greater the chance of losing your investment. The score depends on the Master Trader&apos;s average profit, number of orders, and how stable their strategy is.
                              </p>
                              <div className="space-y-2 pt-1">
                                <div className="flex items-center gap-3">
                                  <span className="bg-[#22c55e] text-black text-[10px] font-semibold px-1.5 py-0.5 rounded-sm min-w-[28px] text-center">1-2</span>
                                  <span className={`text-xs font-medium ${strategy.riskScore && strategy.riskScore <= 2 ? 'text-white' : 'text-gray-500'}`}>Low risk</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="bg-[#f97316] text-black text-[10px] font-semibold px-1.5 py-0.5 rounded-sm min-w-[28px] text-center">3-4</span>
                                  <span className={`text-xs font-medium ${strategy.riskScore && strategy.riskScore > 2 && strategy.riskScore <= 4 ? 'text-white' : 'text-gray-500'}`}>Medium risk</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="bg-[#ef4444] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-sm min-w-[28px] text-center">5-6</span>
                                  <span className={`text-xs font-medium ${strategy.riskScore && strategy.riskScore > 4 ? 'text-white' : 'text-gray-500'}`}>High risk</span>
                                </div>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="mt-3 text-gray-600">
                      {strategy.riskScore !== undefined ? (
                        <span className={`px-2 py-1 rounded-full text-white text-s ${
                          strategy.riskScore <= 2 ? 'bg-[#22c55e]' : 
                          strategy.riskScore <= 4 ? 'bg-[#f97316]' : 'bg-[#ef4444]'
                        }`}>
                          {strategy.riskScore} risk
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">ROI</div>
                    <div className="font-bold text-gray-900 mt-3">{strategy.roi !== undefined ? `${strategy.roi}%` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Profit &amp; Loss</div>
                    <div className={`font-bold ${typeof strategy.profit === 'number' ? (strategy.profit >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-900'} mt-3`}>
                      {typeof strategy.profit === 'number' ? `${strategy.profit >= 0 ? '+' : '-'}${Math.abs(strategy.profit)}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Drawdown</div>
                    <div className="font-bold text-gray-900 mt-3">{strategy.maxDdi !== undefined ? `${strategy.maxDdi}%` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Copiers</div>
                    <div className="font-bold text-gray-900 mt-3">{strategy.copiers !== undefined ? `${strategy.copiers}` : "—"}</div>
                  </div>
                </div>
                <div className="mt-6">
                  <div className="text-gray-500">Detailed Description</div>
                  <div className="mt-1">
                    {strategy.description ? (
                      <p className="text-sm text-gray-700 leading-relaxed">{'\u00A0'}{strategy.description}</p>
                    ) : (
                      <span className="text-gray-400 text-sm">No description</span>
                    )}
                  </div>
                  {strategy.details && (
                    <p className="text-sm text-gray-700 leading-relaxed mt-2">{strategy.details}</p>
                  )}
                  {chatLink && (
                    <div className="mt-2 text-sm">
                      <span className="text-gray-600">Join chat: </span>
                      <a href={chatLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {chatLink}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3D info panel containing uploaded HTML/PDF (wider) */}
          <div className="relative rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xl">
            {/* subtle top gradient border */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
            {strategy.contentUrl ? (
              (() => {
                const mime = (strategy.contentMime || strategy.contentType || '').toLowerCase();
                const url = (strategy.contentUrl || '').toLowerCase();
                const isPdf = mime.includes('pdf') || url.endsWith('.pdf');
                if (isPdf) {
                  return (
                    <object
                      data={strategy.contentUrl}
                      type="application/pdf"
                      className="w-full h-[calc(100vh-7rem)]"
                    >
                      <iframe src={strategy.contentUrl} className="w-full h-full" />
                    </object>
                  );
                }
                return (
                  <iframe
                    src={strategy.contentUrl}
                    className="w-full h-[calc(100vh-7rem)]"
                  />
                );
              })()
            ) : (
              <div className="h-60 bg-gradient-to-br from-purple-50 to-transparent flex items-center justify-center">
                <div className="flex items-center text-sm text-gray-600">
                  <FiInfo className="mr-2" />
                  <span>Powered by <span className="font-semibold text-blue-600">Signals Copy</span></span>
                </div>
              </div>
            )}
          </div>

          {/* Open Positions Section */}
          <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <FiActivity className="text-green-600" />
                Open Positions (MT5)
              </h3>
              <span className="text-xs text-gray-500">Real-time update from server</span>
            </div>
            
            <div className="overflow-x-auto">
              {historyLoading ? (
                <div className="p-12 flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
                </div>
              ) : openPositions.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="px-6 py-3">Time</th>
                      <th className="px-6 py-3">Symbol</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Volume</th>
                      <th className="px-6 py-3">Price Open</th>
                      <th className="px-6 py-3">Price Current</th>
                      <th className="px-6 py-3">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {openPositions.map((pos: any, idx: number) => (
                      <tr key={pos.ticket || idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                          {pos.server_time || new Date(pos.time * 1000).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{pos.symbol}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            pos.type === 0 || pos.type === 'buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {pos.type === 0 ? 'BUY' : pos.type === 1 ? 'SELL' : pos.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{pos.volume}</td>
                        <td className="px-6 py-4 text-gray-600">{pos.price_open}</td>
                        <td className="px-6 py-4 text-gray-600">{pos.price_current}</td>
                        <td className={`px-6 py-4 font-bold ${pos.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {pos.profit > 0 ? '+' : ''}{pos.profit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-500 text-xs">
                  No currently open trades.
                </div>
              )}
            </div>
          </div>

          {/* Master Trade History (Positions) Section */}
          <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <FiMessageCircle className="text-blue-600" />
                Closed Positions History (MT5)
              </h3>
              <span className="text-xs text-gray-500">Updates every 15-20 mins</span>
            </div>
            
            <div className="overflow-x-auto">
              {historyLoading ? (
                <div className="p-12 flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
                </div>
              ) : filteredHistory.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="px-6 py-3">Open Time</th>
                      <th className="px-6 py-3">Close Time</th>
                      <th className="px-6 py-3">Symbol</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Volume</th>
                      <th className="px-6 py-3">Open Price</th>
                      <th className="px-6 py-3">Close Price</th>
                      <th className="px-6 py-3">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentHistory.map((pos: any, idx: number) => (
                      <tr key={pos.position_id || idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                          {pos.server_time_open || new Date(pos.time_open * 1000).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                          {pos.server_time_close || new Date(pos.time_close * 1000).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{pos.symbol}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            pos.type === 0 || pos.type === 'buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {pos.type === 0 ? 'BUY' : pos.type === 1 ? 'SELL' : pos.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{pos.volume}</td>
                        <td className="px-6 py-4 text-gray-600">{pos.price_open}</td>
                        <td className="px-6 py-4 text-gray-600">{pos.price_close}</td>
                        <td className={`px-6 py-4 font-bold ${pos.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {pos.profit > 0 ? '+' : ''}{pos.profit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center text-gray-500">
                  <FiInfo className="mx-auto mb-2 h-8 w-8 opacity-20" />
                  <p>{historyError ? historyError : 'No trade history available yet.'}</p>
                  {!historyError && <p className="text-xs mt-1">History appears after the master account logs in and starts trading.</p>}
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {filteredHistory.length > entriesPerPage && (
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredHistory.length)}</span> of <span className="font-medium">{filteredHistory.length}</span> entries
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1 px-2 text-xs font-medium text-gray-600">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer disclaimer as in FusionX pages */}
          <div className="mt-4 text-[10px] text-gray-600 flex justify-between items-center">
            <p>
              Stock Market Investments are subject to market risk. Please read the offer documents carefully before investing.
              Past performances are no guarantee of future returns. This content is solely for educational purposes only.
            </p>
            <span className="text-[#00d09c]">Disclaimer</span>
          </div>
        </div>
      </main>

      <footer className="bg-[#050608] text-gray-300 border-t border-[#111] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-16">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Image
                  src="/Signals Copy - Logo.png"
                  alt="Signals Copy"
                  width={240}
                  height={72}
                  className="object-contain"
                  quality={100}
                />
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-3">Download Signals Copy App</p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/app-coming-soon"
                    className="flex items-center gap-2 rounded-md border border-gray-500 px-3 py-2 text-[11px] font-medium hover:border-white hover:text-white transition-colors"
                  >
                    <span className="text-xs">App Store</span>
                  </Link>
                  <Link
                    href="/app-coming-soon"
                    className="flex items-center gap-2 rounded-md border border-gray-500 px-3 py-2 text-[11px] font-medium hover:border-white hover:text-white transition-colors"
                  >
                    <span className="text-xs">Android APK</span>
                  </Link>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">Find us on</p>
                <div className="flex items-center gap-3 text-gray-400">
                  <a href="#" aria-label="Facebook" className="hover:text-white">
                    <FiFacebook className="h-4 w-4" />
                  </a>
                  <a href="#" aria-label="Twitter" className="hover:text-white">
                    <FiTwitter className="h-4 w-4" />
                  </a>
                  <a href="#" aria-label="Instagram" className="hover:text-white">
                    <FiInstagram className="h-4 w-4" />
                  </a>
                  <a href="#" aria-label="YouTube" className="hover:text-white">
                    <FiYoutube className="h-4 w-4" />
                  </a>
                  <a href="#" aria-label="LinkedIn" className="hover:text-white">
                    <FiLinkedin className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Quick Links</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link
                    href={session ? '/dashboard' : '/'}
                    className="text-gray-400 hover:text-white"
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/strategies" className="text-gray-400 hover:text-white">
                    Strategies
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-gray-400 hover:text-white">
                    Login
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="text-gray-400 hover:text-white">
                    Sign Up
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-gray-400 hover:text-white">
                    Terms &amp; Conditions
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Resources</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#" className="text-gray-400 hover:text-white">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white">
                    Market News
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white">
                    Learning Center
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white">
                    API Documentation
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Contact us</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2">
                  <FiMail className="h-4 w-4 text-red-500" />
                  <a href="mailto:support@signalscopy.com" className="text-gray-300 hover:text-white">
                    support@signalscopy.com
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <FiPhone className="h-4 w-4 text-red-500" />
                  <a href="tel:+440000000000" className="text-gray-300 hover:text-white">
                    +44 0000 000 000
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <FiMessageCircle className="h-4 w-4 text-red-500" />
                  <span className="text-gray-300">Live Support</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-14 border-t border-gray-700 pt-8 text-[11px] leading-relaxed space-y-4 text-gray-400">
            <p className="space-x-3">
              <span className="font-semibold text-gray-200">Privacy Policy</span>
              <span className="font-semibold text-gray-200">Legal Documentation</span>
              <span className="font-semibold text-gray-200">Cookies</span>
            </p>
            <p>
              Trading leveraged products such as Forex and Derivatives may not be suitable for all investors as they
              carry a high degree of risk to your capital. Please ensure that you fully understand the risks involved,
              taking into account your investment objectives and level of experience, before trading, and if necessary,
              seek independent advice.
            </p>
            <p>
              Signals Copy does not offer services to residents of certain jurisdictions where trading or investment
              activities may be restricted or prohibited by local law.
            </p>
            <p className="text-center text-gray-500 pt-3">
              &copy; {new Date().getFullYear()} Signals Copy. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Plan Selection Dialog - Full Overlay */}
      <Dialog open={planDialogOpen} onOpenChange={(o) => setPlanDialogOpen(o)}>
        <DialogContent className="max-w-md bg-white text-gray-900 border-gray-200 shadow-2xl">
          {/* Custom Overlay with 100% opacity */}
          <div className="fixed inset-0 z-40 bg-black/50" />

          <div className="relative z-50">
            <DialogHeader>
              <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                <DialogTitle className="text-xl font-bold text-gray-900">Select a Plan</DialogTitle>
                <button
                  onClick={() => setPlanDialogOpen(false)}
                  className="text-gray-600 hover:text-gray-900 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <DialogDescription className="mt-4 text-gray-600">
                Choose Premium, Expert, or Pro to continue.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-4">
              {(['Premium', 'Expert', 'Pro'] as const).map((plan) => {
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
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${active
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                      }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg">{plan}</h3>
                        <p className="text-sm text-gray-600 mt-1">{descriptions[plan]}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-teal-600">{rangeLabel}</p>
                        <p className="text-xs text-gray-600 mt-1">{getPlanPercent(plan)}% of your capital for 1 year</p>
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
                className={`w-full py-3 rounded-xl font-semibold transition-all ${selectedPlan
                  ? 'bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
              >
                Continue to Payment
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StrategyInfoPage;
