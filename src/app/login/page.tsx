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
import '@/styles/vuexy-theme.css';

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams?.get('redirect') || '/strategies';
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
      
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        isAdminLogin: false,
        redirect: false,
      });
      
      if (result?.error) {
        setErrors(prev => ({ ...prev, general: 'Invalid email or password. Please check your credentials and try again.' }));
      } else {
        // Clear admin session indicator if it exists
        if (typeof window !== 'undefined') {
          localStorage.removeItem('adminSessionActive');
        }
        // Redirect to intended page after successful login
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
    <div className="vuexy-auth-wrapper">
      <div className="vuexy-auth-card">
        {/* Left: Illustration */}
        <div className="vuexy-auth-illustration">
          <h2 className="text-2xl font-semibold text-center mb-2 text-[#7367f0]">
            Welcome to Copy Trading
          </h2>
          <p className="text-center text-gray-600 max-w-md">
            Trade smarter with breakout strategies. Log in to track your positions and maximize gains.
          </p>
        </div>
        
        {/* Right: Login form */}
        <div className="vuexy-auth-inner">
          <div className="vuexy-auth-brand">
            <Image 
              src="/logo.svg" 
              alt="Copy Trade Logo" 
              width={36} 
              height={36} 
            />
          </div>
          
          <h2 className="vuexy-auth-title text-center">Welcome to Copy Trading! 👋</h2>
          <p className="vuexy-auth-subtitle text-center">
            Please sign-in to your account and start the adventure
          </p>
          
          <form onSubmit={handleLogin}>
            {errors.general && (
              <div className="p-3 mb-4 text-sm text-red-500 bg-red-50 rounded-lg border border-red-200 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.general}
              </div>
            )}
            
            <div className="vuexy-form-group">
              <label className="vuexy-form-label" htmlFor="email">Email</label>
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                required
                className="vuexy-form-control"
              />
              {errors.email && <div className="vuexy-error-msg">{errors.email}</div>}
            </div>
            
            <div className="vuexy-form-group">
              <div className="flex justify-between">
                <label className="vuexy-form-label" htmlFor="password">Password</label>
                <Link href="/forgot-password" className="vuexy-link text-sm">
                  Forgot Password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                name="password"
                placeholder="············"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                required
                className="vuexy-form-control"
              />
              {errors.password && <div className="vuexy-error-msg">{errors.password}</div>}
            </div>
            
            <div className="flex items-center mb-4">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="vuexy-checkbox"
              />
              <label htmlFor="remember-me" className="ml-2 text-sm text-gray-600">
                Remember me
              </label>
            </div>
            
            <Button
              type="submit"
              className="vuexy-btn vuexy-btn-primary vuexy-btn-block"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          
          <div className="vuexy-auth-footer-text">
            <p>
              New on our platform? 
              <Link href="/signup" className="vuexy-link ml-1">
                Create an account
              </Link>
            </p>
            <p className="mt-2">
              <Link href="/admin-login" className="vuexy-link">
                Admin Login
              </Link>
            </p>
          </div>
        </div>
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