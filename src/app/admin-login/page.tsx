"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { validateEmail } from '@/utils/auth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ThemeColorToggle from '@/components/ui/ThemeColorToggle';

// Admin login page component
export default function AdminLoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Redirect if already logged in as admin
  if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
    if (typeof window !== 'undefined') {
       localStorage.setItem('adminSessionActive', 'true');
    }
    router.replace('/admin');
  }

  const sha256Hex = async (input: string) => {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
    const arr = Array.from(new Uint8Array(buf));
    return arr.map(b => b.toString(16).padStart(2, '0')).join('');
  };
  const solvePow = async (action: string, email: string) => {
    const res = await fetch(`/api/auth/pow?action=${encodeURIComponent(action)}`);
    if (!res.ok) throw new Error('Failed to get PoW');
    const { salt, issuedAt, difficulty, signature } = await res.json();
    const prefix = '0'.repeat(difficulty as number);
    let nonce = 0;
    while (true) {
      const h = await sha256Hex(`${salt}:${action}:${email}:${nonce}`);
      if (h.startsWith(prefix)) {
        return { salt, issuedAt, difficulty, nonce, signature, action };
      }
      nonce++;
    }
  };
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    general: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    setErrors(prev => ({ ...prev, [name]: '', general: '' }));
  };

  // Form validation
  const validateForm = () => {
    let valid = true;
    const newErrors = { ...errors };

    if (!validateFormData(formData.email, formData.password, newErrors)) {
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  // Define error type
  interface FormErrors {
    email?: string;
    password?: string;
    general?: string;
  }

  // Helper function to validate form data
  const validateFormData = (email: string, password: string, errors: FormErrors): boolean => {
    let isValid = true;

    if (!validateEmail(email)) {
      errors.email = 'Please enter a valid email';
      isValid = false;
    }

    if (!password.trim()) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    return isValid;
  };

  // Handle admin login submission
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      // Clear any previous errors
      setErrors(prev => ({ ...prev, general: '' }));
      setIsLoading(true);
      
      // Add a flag to indicate this is an admin login attempt

      const pow = await solvePow('admin_login', formData.email);
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        isAdminLogin: true,
        powSalt: pow.salt,
        powIssuedAt: pow.issuedAt,
        powDifficulty: pow.difficulty,
        powNonce: pow.nonce,
        powSignature: pow.signature,
        powAction: pow.action,
        redirect: false,
      });
      
      if (result?.error) {
        setErrors(prev => ({ ...prev, general: 'Invalid admin credentials. Please check your email and password.' }));
      } else {
        if (typeof window !== 'undefined') {
          localStorage.setItem('adminSessionActive', 'true');
          localStorage.removeItem('force_logout');
        }
        router.push('/admin');
      }
    } catch (error) {
      console.error('Error during admin login:', error);
      setErrors(prev => ({ ...prev, general: 'Failed to log in. Please try again.' }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
      <div className="w-full max-w-md">
        {/* Header with admin branding */}
        <div className="flex justify-between items-center mb-8 px-2">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              Admin Panel
            </h1>
            <p className="mt-2 text-black">
            Secure Admin Login Portal
          </p>
          </div>
          <div className="ml-4">
            <ThemeColorToggle />
          </div>
        </div>

        {/* Admin login card with distinct styling */}
        <Card className="w-full bg-white shadow-lg border border-gray-200 rounded-lg">
          <form onSubmit={handleAdminLogin} className="space-y-6 p-6">
            {/* Admin warning message */}
            <div className="p-4 mb-6 text-sm text-blue-800 bg-blue-50 rounded-lg border border-blue-200 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              This is the administrator login portal. Only authorized personnel should access this area.
            </div>
            
            {/* Error message display */}
            {errors.general && (
              <div className="p-3 mb-4 text-sm text-red-800 bg-red-50 rounded-lg border border-red-200 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.general}
              </div>
            )}
            
            {/* Admin email input */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-black">
            Admin Email
          </label>
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="admin@example.com"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                required
                className="w-full py-6 text-lg bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500/20"
              />
              {errors.email && (
                <p className="text-black text-xs mt-1">{errors.email}</p>
              )}
            </div>
            
            {/* Admin password input */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-black">
            Admin Password
          </label>
              <Input
                id="password"
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                required
                className="w-full py-6 text-lg bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500/20"
              />
              {errors.password && (
                <p className="text-black text-xs mt-1">{errors.password}</p>
              )}
            </div>
            
            {/* Remember me checkbox */}
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-5 w-5 text-blue-500 focus:ring-blue-500/20 border-slate-600 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-black">
                Remember me
              </label>
            </div>
            
            {/* Admin login button with gradient effect */}
            <Button
              type="submit"
              className="w-full py-6 text-lg font-medium bg-gradient-to-r from-[#00d09c] to-[#00b085] hover:from-[#00c08c] hover:to-[#00a075] text-white transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Authenticating...
                </>
              ) : 'Admin Login'}
            </Button>
          </form>

          {/* Additional links and info */}
          <div className="mt-4 text-center text-sm pb-6">
            <p className="text-black">
              Not an admin? <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">User Login</Link>
            </p>
            
            {/* Admin test credentials info */}
            <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200 mx-4">
              <p className="text-gray-700 font-medium text-xs uppercase tracking-wider mb-2">Admin Test Credentials</p>
              <p className="text-xs text-gray-600">
                Email: <span className="font-mono bg-gray-200 px-2 py-1 rounded text-blue-700">admin@stockanalysis.com</span><br/>
                Password: <span className="font-mono bg-gray-200 px-2 py-1 rounded text-blue-700">admin123</span>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
