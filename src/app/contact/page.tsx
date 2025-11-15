"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import UserLayout from "@/components/UserLayout";

export default function ContactPage() {
  const params = useSearchParams();
  const tx = params.get("tx") || "";
  const [subject, setSubject] = useState("Payment Query");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const submit = async () => {
    try {
      setLoading(true);
      setResult(null);
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, email, tx }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to send message");
      setResult("Your message has been sent");
      setMessage("");
    } catch (e: any) {
      setResult(e.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <UserLayout>
      <div className="min-h-screen bg-[#0f1527] text-white px-6 py-8">
        <div className="max-w-2xl mx-auto bg-[#161d31] border border-[#283046] rounded-2xl p-6 fx-3d-card">
          <h1 className="text-2xl font-bold mb-2">Contact Us</h1>
          <p className="text-sm text-gray-400 mb-6">Send your queries to the admin team</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg bg-[#1a1f2e] border border-[#283046] px-3 py-2"
                placeholder="Subject"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Your Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-[#1a1f2e] border border-[#283046] px-3 py-2"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-lg bg-[#1a1f2e] border border-[#283046] px-3 py-2 min-h-[140px]"
                placeholder="Describe your query"
              />
            </div>
            {tx ? (
              <div className="text-xs text-gray-400">Related Transaction: {tx}</div>
            ) : null}
            <div className="flex gap-3">
              <button
                onClick={submit}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#7c3aed] to-[#a855f7] disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send"}
              </button>
              {result && <div className="text-sm text-gray-300">{result}</div>}
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
}