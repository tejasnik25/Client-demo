"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import UserLayout from "@/components/UserLayout";

const PaymentStatusInner: React.FC = () => {
  const params = useSearchParams();
  const tx = params.get("tx");

  return (
    <UserLayout>
      <div className="min-h-screen bg-[#0f1527] text-white px-6 py-10">
        <div className="max-w-3xl mx-auto bg-[#161d31] border border-[#283046] rounded-2xl p-8 text-center">
          <h1 className="text-2xl font-bold">Your payment request is in queue</h1>
          <p className="mt-3 text-gray-300">
            Once your payment gets approved, your request will be approved and the strategy will be added in the Running Strategy page.
          </p>
          {tx && (
            <p className="mt-2 text-sm text-gray-400">Transaction ID: {tx}</p>
          )}
          <div className="mt-6 flex items-center justify-center gap-4">
            <Link href="/strategies/running" className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:from-[#6d28d9] hover:to-[#9333ea]">
              Go to Running Strategy
            </Link>
            <Link href="/profile/billing" className="px-4 py-2 rounded-lg border border-[#283046] bg-[#1a1f2e] hover:bg-[#1f243a]">
              View Billing Information
            </Link>
          </div>
        </div>
      </div>
    </UserLayout>
  );
};

export default function PaymentStatusPage() {
  return (
    <Suspense>
      <PaymentStatusInner />
    </Suspense>
  );
}