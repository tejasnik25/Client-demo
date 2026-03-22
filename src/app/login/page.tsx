'use client';

// This component is a Client Component that handles user authentication
// It uses next-auth for authentication and manages form state with React hooks

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { validateEmail } from '@/utils/auth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import '@/styles/vuexy-theme.css';

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams?.get('redirect') || '/strategies';
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
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    general: '',
  });
  const [isLoading, setIsLoading] = useState(false);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    setErrors(prev => ({ ...prev, [name]: '', general: '' }));
  };

  const validateForm = () => {
    let valid = true;
    const newErrors = { ...errors };

    if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email';
      valid = false;
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      // Clear any previous errors
      setErrors(prev => ({ ...prev, general: '' }));
      setIsLoading(true);
      
      // Pre-check if account is disabled
      try {
        const userRes = await fetch(`/api/users?email=${encodeURIComponent(formData.email)}`);
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.user && userData.user.enabled === false) {
            setErrors(prev => ({ ...prev, general: 'Your account access has been disabled, please contact admin@gmail.com to enable your account.' }));
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // ignore — proceed to signIn; any server error won't block login check
      }


      const pow = await solvePow('login', formData.email);
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        isAdminLogin: false,
        powSalt: pow.salt,
        powIssuedAt: pow.issuedAt,
        powDifficulty: pow.difficulty,
        powNonce: pow.nonce,
        powSignature: pow.signature,
        powAction: pow.action,
        redirect: false,
      });
      
      if (result?.error) {
        setErrors(prev => ({ ...prev, general: result.error === 'Account disabled' ? 'Your account access has been disabled, please contact admin@gmail.com to enable your account.' : 'Invalid email or password. Please check your credentials and try again.' }));
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('adminSessionActive');
          localStorage.removeItem('force_logout');
        }
        router.push(redirectPath);
      }
    } catch (error) {
      console.error('Error logging in:', error);
      setErrors(prev => ({ ...prev, general: 'Failed to log in. Please try again.' }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-black">
            Log in to your Personal Area
          </h2>
          <p className="mt-2 text-sm text-black">
            Don't have an account?{' '}
            <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up
            </Link>
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {errors.general && (
            <div className="p-3 mb-4 text-sm text-red-500 bg-red-50 rounded-lg border border-red-200 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {errors.general}
            </div>
          )}
          
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-black rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
              />
            </div>
            <div className="relative">
              <label htmlFor="password" title="Password" className="sr-only">Password</label>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-black rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm pr-10"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[10px] text-gray-400 hover:text-gray-600 z-20"
              >
                {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-black">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <Link href="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500">
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <Button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </div>
        </form>
        <p className="mt-2 text-center text-sm text-black">
          <Link href="/admin-login" className="font-medium text-blue-600 hover:text-blue-500">
            Admin Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // Wrap searchParams usage in Suspense per Next.js guidance
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  );
}
