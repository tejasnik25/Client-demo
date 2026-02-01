import { Geist, Geist_Mono } from "next/font/google";
import '../globals.css';
import { Metadata } from 'next';

// Import fonts like the root layout
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Admin login page metadata
export const metadata: Metadata = {
  title: 'Admin Login - Signals Copy',
  description: 'Secure login portal for administrators',
};

// Simple layout for the admin login page
export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen ${geistSans.variable} ${geistMono.variable} antialiased`}>
      {children}
    </div>
  );
}