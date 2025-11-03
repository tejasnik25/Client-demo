"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { FiFolder, FiTrendingUp } from "react-icons/fi";
import { FaFire } from "react-icons/fa";

import Button from "@/components/ui/Button";
import UserLayout from "@/components/UserLayout";

// Types for running and listed strategies
type RunningStrategy = {
  id: string;
  name: string;
  orders: any[];
  profit: number;
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
  const [activeTab, setActiveTab] = useState("day");
  const [running, setRunning] = useState<RunningStrategy[]>([]);
  const [listed, setListed] = useState<ListedStrategy[]>([]);
  const [loadingRunning, setLoadingRunning] = useState(true);
  const [loadingListed, setLoadingListed] = useState(true);

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
    <div className="space-y-4 md:space-y-6">
      {/* Header with greeting */}
      <div className="bg-gradient-to-br from-[#101b2d] to-[#0e1726] rounded-2xl p-4 md:p-6 border border-[#1b2e4b] shadow-2xl shadow-black/30 transform-gpu">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-orange-500 p-2 rounded-full">
              <FaFire className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-white">Hey! {session?.user?.name?.split(" ")[0] || "User"}</h2>
              <p className="text-xs md:text-sm text-gray-400">Welcome back</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              className={`px-3 py-1 rounded-md text-xs md:text-sm ${activeTab === "day" ? "bg-[#00d09c] text-white" : "bg-[#0e1726] text-gray-400"}`}
              onClick={() => setActiveTab("day")}
            >
              Day
            </button>
            <button
              className={`px-3 py-1 rounded-md text-xs md:text-sm ${activeTab === "week" ? "bg-[#00d09c] text-white" : "bg-[#0e1726] text-gray-400"}`}
              onClick={() => setActiveTab("week")}
            >
              Week
            </button>
            <button
              className={`px-3 py-1 rounded-md text-xs md:text-sm ${activeTab === "month" ? "bg-[#00d09c] text-white" : "bg-[#0e1726] text-gray-400"}`}
              onClick={() => setActiveTab("month")}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Metrics removed */}

      {/* Two partitions: Running & Listed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Running strategies */}
        <div className="bg-gradient-to-br from-[#101b2d] to-[#0e1726] rounded-2xl p-4 md:p-6 border border-[#1b2e4b] shadow-2xl shadow-black/30 transform-gpu">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg md:text-xl font-semibold text-white">Current Positions</h2>
            <Link href="/strategies/running" className="text-[#00d09c] text-sm hover:underline">
              View all
            </Link>
          </div>
          {loadingRunning ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-[#00d09c]" />
            </div>
          ) : running.length > 0 ? (
            <div className="flex flex-col gap-4">
              {running.slice(0, 4).map((strategy) => (
                <Link
                  key={strategy.id}
                  href={`/strategies/${strategy.id}/info`}
                  className="bg-gradient-to-br from-[#0e1726] to-[#1b2e4b] rounded-xl p-4 md:p-5 border border-[#22304d] shadow-xl shadow-black/40 transition-transform transform-gpu hover:-translate-y-0.5 hover:shadow-2xl"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="bg-[#172238] p-3 rounded-lg shadow-inner">
                        <FiTrendingUp className="h-5 w-5 text-[#00d09c]" />
                      </div>
                      <h3 className="font-medium text-white text-sm md:text-base truncate">{strategy.name}</h3>
                    </div>
                    <div className="flex items-center gap-4 md:gap-8 text-xs md:text-sm w-full sm:w-auto flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                      <div>
                        <p className="text-gray-400">Orders</p>
                        <p className="text-white text-right">{strategy.orders?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Profit</p>
                        <p className={`${strategy.profit > 0 ? "text-green-500" : strategy.profit < 0 ? "text-red-500" : "text-white"} text-right`}>
                          ${strategy.profit?.toFixed(2) || "0.00"}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="bg-[#0e1726] p-4 rounded-full mb-4">
                <FiFolder className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-base md:text-lg font-medium text-white mb-2">Nothing to show</h3>
              <p className="text-gray-400 mb-4">You don't have any running strategies yet.</p>
              <Link href="/strategies">
                <Button variant="primary">Browse Strategies</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Listed strategies */}
        <div className="bg-gradient-to-br from-[#101b2d] to-[#0e1726] rounded-2xl p-4 md:p-6 border border-[#1b2e4b] shadow-2xl shadow-black/30 transform-gpu">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg md:text-xl font-semibold text-white">Listed Strategies</h2>
            <Link href="/strategies" className="text-[#00d09c] text-sm hover:underline">
              View all
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
                  className="bg-gradient-to-br from-[#0e1726] to-[#1b2e4b] rounded-xl p-4 md:p-5 border border-[#22304d] shadow-xl shadow-black/40 transition-transform transform-gpu hover:-translate-y-0.5 hover:shadow-2xl"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="bg-[#172238] p-3 rounded-lg shadow-inner">
                        <FiTrendingUp className="h-5 w-5 text-[#a855f7]" />
                      </div>
                      <h3 className="font-medium text-white text-sm md:text-base truncate">{s.name}</h3>
                    </div>
                    <div className="flex items-center gap-4 md:gap-8 text-xs md:text-sm w-full sm:w-auto flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                      <div>
                        <p className="text-gray-400">Category</p>
                        <p className="text-white text-right">{s.category}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Performance</p>
                        <p className="text-green-500 text-right">{s.performance}%</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="bg-[#0e1726] p-4 rounded-full mb-4">
                <FiFolder className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-base md:text-lg font-medium text-white mb-2">No strategies found</h3>
              <p className="text-gray-400 mb-4">Explore and deploy strategies from the catalog.</p>
              <Link href="/strategies">
                <Button variant="primary">Explore Strategies</Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Footer Disclaimer */}
      <div className="bg-[#283046] rounded-lg p-4 mt-6">
        <p className="text-xs text-gray-400 text-center">
          Stock Market investments are subject to market risk. Please read the offer documents carefully before investing. Past performances are no guarantee of future returns. This content is solely for educational purposes only.
        </p>
        <p className="text-xs text-green-500 text-right mt-1">Disclaimer</p>
      </div>
    </div>
  );
}

// Dashboard page
export default function Dashboard() {
  return (
    <UserLayout>
      <DashboardPageContent />
    </UserLayout>
  );
}