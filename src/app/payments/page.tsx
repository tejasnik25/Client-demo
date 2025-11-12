"use client";
import React, { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/ui/Header";
import { Footer } from "@/components/ui/Footer";

const PaymentInner: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const plan = searchParams.get("plan");
  const [paymentMethod, setPaymentMethod] = useState("usdt-erc20");
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);

  useEffect(() => {
    if (timeLeft === 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  };

  const handlePayment = () => {
    setIsLoading(true);
    // Simulate payment processing
    setTimeout(() => {
      setIsLoading(false);
      alert(`Processing ${plan} plan payment via ${paymentMethod}`);
      router.push("/dashboard");
    }, 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-gray-800 rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-6 text-center">
            Complete Your Payment
          </h1>
          <div className="text-center text-red-500 font-semibold mb-4">
            Time Left: {formatTime(timeLeft)}
          </div>
          <div className="mb-6">
            <p className="text-lg">
              You have selected the <span className="font-semibold">{plan}</span>{" "}
              plan.
            </p>
          </div>
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">
              Choose Payment Method
            </h2>
            <div className="flex flex-col space-y-4">
              <label className="flex items-center p-4 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="usdt-erc20"
                  checked={paymentMethod === "usdt-erc20"}
                  onChange={() => setPaymentMethod("usdt-erc20")}
                  className="form-radio h-5 w-5 text-blue-500"
                />
                <span className="ml-4 text-lg">USDT (ERC20)</span>
              </label>
              <label className="flex items-center p-4 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="usdt-trc20"
                  checked={paymentMethod === "usdt-trc20"}
                  onChange={() => setPaymentMethod("usdt-trc20")}
                  className="form-radio h-5 w-5 text-blue-500"
                />
                <span className="ml-4 text-lg">USDT (TRC20)</span>
              </label>
              <label className="flex items-center p-4 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="upi"
                  checked={paymentMethod === "upi"}
                  onChange={() => setPaymentMethod("upi")}
                  className="form-radio h-5 w-5 text-blue-500"
                />
                <span className="ml-4 text-lg">UPI</span>
              </label>
            </div>
          </div>
          <button
            onClick={handlePayment}
            disabled={isLoading}
            className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <svg
                  className="animate-spin h-5 w-5 mr-3 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing...
              </div>
            ) : (
              "Confirm Payment"
            )}
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading...</div>}>
      <PaymentInner />
    </Suspense>
  );
}