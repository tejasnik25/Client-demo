"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import { FiArrowLeft } from "react-icons/fi";
import { Strategy } from "@/types/strategy";
import { FiInfo } from "react-icons/fi";

const StrategyInfoPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?redirect=${encodeURIComponent(`/strategies/${params.id}/info`)}`);
    }
  }, [status, router, params.id]);

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

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#0e1726] text-white flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="min-h-screen bg-[#0e1726] text-white flex items-center justify-center">
        <div className="bg-[#161d31] border border-[#283046] rounded-xl p-6">
          <p className="text-red-300">{error || "Strategy not found"}</p>
          <div className="mt-4">
            <Button onClick={() => router.push("/strategies")}>Back to Strategies</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e1526] text-white relative overflow-x-hidden">
      {/* Ambient gradient glows for 3D feel */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />
      <div className="pointer-events-none absolute top-20 -right-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />

      {/* Top Navigation (no sidebar) */}
      <header className="sticky top-0 z-50 h-16 px-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#1b2e4b] bg-[#0e1526]/80 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-[#131a2a] shadow-inner">
            <Image src="/financial-growth.svg" alt="FusionX" width={24} height={24} />
          </div>
          <h1 className="text-xl font-semibold bg-gradient-to-r from-[#7c3aed] to-[#a855f7] bg-clip-text text-transparent">Copy Trade</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="px-2 py-1 h-8 w-8 flex items-center justify-center"
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
          {/* Strategy header row with 3D card styling */}
          <div className="group relative rounded-2xl mb-6 p-6 bg-gradient-to-br from-[#111a2e] to-[#0e1726] border border-white/10 shadow-[0_40px_80px_-20px_rgba(124,58,237,0.35)] transform-gpu transition-all hover:-translate-y-0.5 hover:shadow-[0_60px_120px_-20px_rgba(124,58,237,0.45)]">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 bg-gradient-to-br from-[#7c3aed] to-[#a855f7] rounded-xl flex items-center justify-center p-2 ring-1 ring-white/20 shadow-lg">
                  <div className="w-8 h-8 bg-white/25 rounded" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">{strategy.name}</h2>
                    <span className="text-xs text-gray-400">by Fusion</span>
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {strategy.tag && (
                      <span className="text-xs px-2 py-1 bg-[#7c3aed] text-white rounded-full whitespace-nowrap">{strategy.tag}</span>
                    )}
                    {strategy.category && (
                      <span className="text-xs px-2 py-1 bg-[#283046] rounded-full uppercase whitespace-nowrap">{strategy.category}</span>
                    )}
                    {strategy.riskLevel && (
                      <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                        strategy.riskLevel === "High" ? "bg-red-900/30 text-red-300" :
                        strategy.riskLevel === "Medium" ? "bg-yellow-900/30 text-yellow-300" :
                        "bg-green-900/30 text-green-300"
                      }`}>
                        {strategy.riskLevel}
                      </span>
                    )}
                 </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6 text-xs sm:text-sm w-full md:w-auto">
                {/* New metrics with fallback */}
                <div>
                  <div className="text-gray-400">Min Capital</div>
                  <div className="font-bold text-white">{strategy.minCapital !== undefined ? `₹${strategy.minCapital.toLocaleString()}` : "—"}</div>
                </div>
                <div>
                  <div className="text-gray-400">Avg Drawdown</div>
                  <div className="font-bold text-white">{strategy.avgDrawdown !== undefined ? `${strategy.avgDrawdown}%` : "—"}</div>
                </div>
                <div>
                  <div className="text-gray-400">Risk Reward</div>
                  <div className="font-bold text-white">{strategy.riskReward !== undefined ? `${strategy.riskReward}` : "—"}</div>
                </div>
                <div>
                  <div className="text-gray-400">Win Streak</div>
                  <div className="font-bold text-white">{strategy.winStreak !== undefined ? `${strategy.winStreak}` : "—"}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 3D info panel containing uploaded HTML/PDF (wider) */}
          <div className="relative rounded-2xl border border-white/10 bg-[#0e1726] overflow-hidden shadow-2xl">
            {/* subtle top gradient border */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
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
                      className="w-full h-[82vh]"
                    >
                      <iframe src={strategy.contentUrl} className="w-full h-full" />
                    </object>
                  );
                }
                return (
                  <iframe
                    src={strategy.contentUrl}
                    className="w-full h-[82vh]"
                  />
                );
              })()
            ) : (
              <div className="h-60 bg-gradient-to-br from-[#7c3aed]/20 to-transparent flex items-center justify-center">
                <div className="flex items-center text-sm text-gray-400">
                  <FiInfo className="mr-2" />
                  <span>Powered by <span className="font-semibold text-blue-400">Copy Trade</span></span>
                </div>
              </div>
            )}
          </div>

          {/* Footer disclaimer as in FusionX pages */}
          <div className="mt-4 text-[10px] text-gray-400 flex justify-between items-center">
            <p>
              Stock Market Investments are subject to market risk. Please read the offer documents carefully before investing.
              Past performances are no guarantee of future returns. This content is solely for educational purposes only.
            </p>
            <span className="text-[#00d09c]">Disclaimer</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StrategyInfoPage;