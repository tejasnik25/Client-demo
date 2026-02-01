"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { FiFolder } from "react-icons/fi";

import Button from "@/components/ui/Button";
import UserLayout from "@/components/UserLayout";
import Badge from "@/components/ui/Badge";

// Types for running and listed strategies
type RunningStrategy = {
  id: string;
  name: string;
  orders: any[];
  profit: number;
  adminStatus?: string;
};

type ListedStrategy = {
  id: string;
  name: string;
  description: string;
  performance: number;
  riskLevel: "Low" | "Medium" | "High";
  category: "Growth" | "Income" | "Momentum" | "Value";
  imageUrl: string;
};

// Dashboard page content
function DashboardPageContent() {
  const { data: session } = useSession();
  const [running, setRunning] = useState<RunningStrategy[]>([]);
  const [listed, setListed] = useState<ListedStrategy[]>([]);
  const [loadingRunning, setLoadingRunning] = useState(true);
  const [loadingListed, setLoadingListed] = useState(true);

  const renderStatusBadge = (status: string) => {
    const k = (status || '').toLowerCase();
    if (k === 'running') return <Badge variant="success" className="text-[10px] px-2 py-0.5">Running</Badge>;
    if (k === 'in-process' || k === 'in_process') return <Badge variant="warning" className="text-[10px] px-2 py-0.5">In-Process</Badge>;
    if (k === 'wrong-account-password') return <Badge variant="destructive" className="text-[10px] px-2 py-0.5">Wrong Password</Badge>;
    if (k === 'wrong-account-id') return <Badge variant="destructive" className="text-[10px] px-2 py-0.5">Wrong ID</Badge>;
    if (k === 'wrong-account-server-name') return <Badge variant="destructive" className="text-[10px] px-2 py-0.5">Wrong Server</Badge>;
    if (k === 'disconnected' || k === 'stopped') return <Badge variant="destructive" className="text-[10px] px-2 py-0.5">Disconnected</Badge>;
    // Default fallback
    return null;
  };

  const stratById = useMemo(() => {
    const map = new Map<string, any>();
    (listed as any[]).forEach((s) => {
      if (s && s.id) {
        map.set(s.id, s);
      }
    });
    return map;
  }, [listed]);

  // Fetch running strategies
  useEffect(() => {
    const fetchRunning = async () => {
      try {
        const response = await fetch("/api/strategies/running");
        const data = await response.json();
        setRunning(data.strategies || []);
      } catch (error) {
        console.error("Error fetching running strategies:", error);
        setRunning([]);
      } finally {
        setLoadingRunning(false);
      }
    };
    fetchRunning();
  }, []);

  // Fetch listed strategies (enabled)
  useEffect(() => {
    const fetchListed = async () => {
      try {
        const response = await fetch("/api/strategies");
        const data = await response.json();
        const enabled = (data.strategies || []).filter((s: any) => s.enabled !== false);
        setListed(enabled);
      } catch (error) {
        console.error("Error fetching listed strategies:", error);
        setListed([]);
      } finally {
        setLoadingListed(false);
      }
    };
    fetchListed();
  }, []);

  // Metrics removed per request
  return (
   <div className="mt-6 space-y-4 md:space-y-40 md:mt-8 lg:mt-10">
      <div className="bg-white rounded-[40px] border border-gray-200 shadow-md px-6 py-6 md:py-0 md:px-10 h-auto md:h-40 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-10 lg:gap-16">
        <div className="text-center md:text-left flex flex-col justify-center">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-extrabold tracking-tight text-gray-900 leading-tight">
            COPY TRADING<br />STRATEGIES
          </h2>
          <p className="mt-1 md:mt-2 text-xs md:text-sm text-gray-600">
            Find the Strategy Provider that matches your<br />goals. Follow with just one click.
          </p>
        </div>
        <div className="hidden md:flex justify-center">
          <Image
            src="/Ad-1.png"
            alt="trading_hero advertisement"
            width={1200}
            height={400}
            className="h-32 md:h-52 lg:h-64 w-auto object-contain"
            priority
            quality={100}
          />
        </div>
      </div>

      {/* Two partitions: Running & Listed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Running strategies */}
        <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">Copier</h2>
            <Link href="/strategies" className="inline-block">
              <button className="px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-white text-xs md:text-sm font-semibold shadow-sm">
                SHOP NOW
              </button>
            </Link>
          </div>
          {loadingRunning ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-[#00d09c]" />
            </div>
          ) : running.length > 0 ? (
            <div className="flex flex-col gap-4">
              {running.slice(0, 4).map((r) => {
                const base = (r as any) || {};
                const s = stratById.get(base.id) || base;
                const imageUrl = (s as any).imageUrl || "/strategy-icon.svg";
                const accountId = base.mtAccountId;
                const platform = base.platform;
                const tag = (s as any).tag;
                return (
                  <Link
                    key={r.id}
                    href={`/strategies/${r.id}/info`}
                    className="bg-white rounded-2xl p-4 md:p-5 border border-gray-200 shadow-sm transition-transform transform-gpu hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
                      <div className="flex items-center gap-4 flex-[0_0_auto] w-full md:w-auto">
                        <div className="relative w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200">
                          {imageUrl ? (
                            <img src={imageUrl} alt={s.name || r.name} className="w-full h-full object-cover" />
                          ) : (
                            <Image src="/strategy-icon.svg" alt="Strategy Icon" width={56} height={56} />
                          )}
                        </div>
                        <div>
                          <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-0 mb-1 text-[10px] px-2 py-0.5">
                            Master
                          </Badge>
                          <h4 className="text-base md:text-lg font-semibold text-gray-900 truncate max-w-xs">
                            {s.name || r.name}
                          </h4>
                        </div>
                      </div>

                      <div className="hidden md:block h-10 w-px bg-gray-200 rounded-full" />

                      <div className="flex items-center gap-4 flex-[0_0_auto] w-full md:w-auto">
                        <div className="relative w-14 h-14 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200">
                          {imageUrl ? (
                            <img src={imageUrl} alt={s.name || r.name} className="w-full h-full object-cover" />
                          ) : (
                            <Image src="/strategy-icon.svg" alt="Strategy Icon" width={56} height={56} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-23 mb-1">
                            <Badge className="bg-green-600 hover:bg-green-700 text-white border-0 text-[10px] px-2 py-0.5">
                              Slave
                            </Badge>
                            {renderStatusBadge((base as any).adminStatus)}
                          </div>
                          <div className="text-sm md:text-base font-semibold text-gray-900">
                            {accountId || "No ID"} {platform ? `(${platform})` : ""}
                          </div>
                          {tag && (
                            <span className="mt-1 inline-block text-[12px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">
                              {tag}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <FiFolder className="h-8 w-8 text-gray-600" />
              </div>
              <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">Nothing to show</h3>
              <p className="text-gray-600 mb-4">You don't have any running strategies yet.</p>
              <Link href="/strategies">
                <Button className="bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] text-white">Browse Strategies</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Listed strategies */}
        <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">Top Master</h2>
            <Link href="/strategies" className="inline-block">
              <button className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-600 text-white text-xs md:text-sm font-semibold shadow-sm">
                SHOP NOW
              </button>
            </Link>
          </div>
          {loadingListed ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-[#00d09c]" />
            </div>
          ) : listed.length > 0 ? (
            <div className="flex flex-col gap-4">
              {listed.slice(0, 4).map((s) => (
                <Link
                  key={s.id}
                  href={`/strategies/${s.id}/info`}
                  className="bg-white rounded-2xl p-4 md:p-5 border border-gray-200 shadow-sm transition-transform transform-gpu hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative w-12 h-12 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200">
                      {s.imageUrl ? (
                        <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" />
                      ) : (
                        <Image src="/strategy-icon.svg" alt="Strategy Icon" width={48} height={48} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-white text-[11px] font-semibold ${
                            (typeof (s as any).riskScore === "number" ? (s as any).riskScore : 1) <= 2 ? 'bg-green-600' :
                            (typeof (s as any).riskScore === "number" ? (s as any).riskScore : 1) <= 4 ? 'bg-[#f97316]' : 'bg-red-600'
                          }`}>
                            {typeof (s as any).riskScore === "number" ? `${(s as any).riskScore} Risk` : "1 Risk"}
                          </span>
                          <h3 className="mt-2 text-sm md:text-base font-semibold text-gray-900">{s.name}</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-xs md:text-sm">
                          <div className="text-center sm:text-left">
                            <div className="text-gray-600 mb-1">ROI</div>
                            <div className="text-green-600 font-bold">
                              {(() => {
                                const roi = (s as any).roi || 0;
                                return roi > 0 ? `+${roi}%` : "+0%";
                              })()}
                            </div>
                          </div>
                          <div className="text-center sm:text-left">
                            <div className="text-gray-600 mb-1">Drawdown</div>
                            <div className="text-gray-900 font-bold">
                              {typeof (s as any).maxDdi === "number" ? `${(s as any).maxDdi}%` : "0%"}
                            </div>
                          </div>
                          <div className="text-center sm:text-left">
                            <div className="text-gray-600 mb-1">Copiers</div>
                            <div className="text-gray-900 font-bold">
                              {(s as any).copiers || 0}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <FiFolder className="h-8 w-8 text-gray-600" />
              </div>
              <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">No strategies found</h3>
              <p className="text-gray-600 mb-4">Explore and deploy strategies from the catalog.</p>
              <Link href="/strategies">
                <Button className="bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00b085] hover:to-[#00d09c] text-white">Explore Strategies</Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="my-10 md:my-16 lg:my-28 px-2 md:px-0">
        <div className="mx-auto max-w-6xl flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="max-w-xl">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 leading-tight">
            BECOME A
            <br />
            <span className="text-red-600">STRATEGY PROVIDER</span>
          </h2>
          <p className="mt-4 text-sm md:text-base text-gray-700">
            Showcase your trading skills to other traders in the community, build an inventory of followers and get
            rewarded for your successful performance. Lead the way and amplify your gains.
          </p>
          <div className="mt-6">
            <button className="inline-flex items-center justify-center px-6 py-3 rounded-xl border-2 border-red-600 bg-transparent text-black text-xs md:text-sm font-semibold tracking-wide shadow-sm hover:bg-red-600 hover:text-white transition-colors duration-300">
              BECOME A STRATEGY PROVIDER
            </button>
            <p className="mt-2 text-[10px] text-gray-500">Terms and Conditions apply</p>
          </div>
          </div>
          <div className="flex justify-center lg:justify-end w-full lg:w-auto">
            <Image
              src="/Ad-2.png"
              alt="Become a strategy provider"
              width={1200}
              height={600}
              className="w-full max-w-xl md:max-w-2xl h-auto object-contain"
              quality={100}
            />
          </div>
        </div>
      </div>
      
    </div>
  );
}

// Dashboard page
function DashboardPageInner() {
  return (
    <UserLayout>
      <DashboardPageContent />
    </UserLayout>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-900">Loading dashboard...</div>}>
      <DashboardPageInner />
    </Suspense>
  );
}
