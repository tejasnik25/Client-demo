import Link from "next/link";
import Image from "next/image";

export default function AppComingSoonPage() {
  return (
    <div className="min-h-screen bg-[#050608] text-gray-100 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="max-w-xl text-center space-y-6">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/10 mb-8 transform hover:scale-105 transition-transform duration-300">
            <Image
              src="/Signals Copy - Logo.png"
              alt="Signals Copy"
              width={240}
              height={80}
              className="object-contain"
              priority
              quality={100}
            />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Mobile application launching soon
          </h1>
          <p className="text-sm md:text-base text-gray-300">
            We are working on our Signals Copy mobile app for iOS and Android.
            You will be able to download it from the App Store and as an
            Android APK very soon.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 px-6 py-2 text-sm font-semibold text-white"
            >
              Back to Home
            </Link>
            <Link
              href="/strategies"
              className="inline-flex items-center justify-center rounded-full border border-gray-500 hover:border-white px-6 py-2 text-sm font-semibold text-gray-200 hover:text-white"
            >
              Explore Strategies
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
