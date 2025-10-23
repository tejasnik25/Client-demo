'use client';

// This component is a Client Component that handles user authentication
// It uses next-auth for authentication and manages form state with React hooks

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { validateEmail } from '@/utils/auth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ThemeColorToggle from '@/components/ui/ThemeColorToggle';

export default function LoginPage() {
  const router = useRouter();
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
        // Redirect to strategies page after successful login
        router.push('/strategies');
      }
    } catch (error) {
      console.error('Error logging in:', error);
      setErrors(prev => ({ ...prev, general: 'Failed to log in. Please try again.' }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 auth-gradient-bg">
      <div className="w-full max-w-md">
        <div className="flex justify-between items-center mb-8 px-2">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              Stock Analysis
            </h1>
            <p className="mt-2 text-gray-200">
              Log in to your account
            </p>
          </div>
          <div className="ml-4">
            <ThemeColorToggle />
          </div>
        </div>

        <Card className="w-full auth-card bg-white/10 dark:bg-gray-900/30 backdrop-blur-md">
          <form onSubmit={handleLogin} className="space-y-4 p-4">
            {errors.general && (
              <div className="p-3 mb-4 text-sm text-pink-300 bg-pink-900/20 rounded-lg border border-pink-800 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.general}
              </div>
            )}
            
            <Input
              label="Email Address"
              type="email"
              name="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              required
              className="auth-input text-white focus:ring-2 focus:ring-blue-500 w-full py-6 text-lg"
            />
            <Input
              label="Password"
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              required
              className="auth-input text-white focus:ring-2 focus:ring-blue-500 w-full py-6 text-lg"
            />
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-200">
                  Remember me
                </label>
              </div>
              <div className="text-sm">
                <a href="#" className="text-blue-400 hover:text-blue-300 transition-colors">
                  Forgot password?
                </a>
              </div>
            </div>
            
            <Button
                type="submit"
                className="w-full py-6 text-lg auth-button transition-all duration-300 mt-6"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </>
                ) : 'Sign In'}
              </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p className="text-gray-200">
              Don&#39;t have an account?{' '}
              <Link href="/signup" className="text-blue-400 hover:text-blue-300 transition-colors">
                Sign up
              </Link>
            </p>
            <p className="text-gray-300 mt-2">
              Are you an administrator?{' '}
              <Link href="/admin-login" className="text-purple-400 hover:text-purple-300 transition-colors font-medium">
                Admin Login
              </Link>
            </p>
            <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
              <p className="text-white font-medium">Testing Information</p>
              <p className="text-xs text-gray-300 mt-1">
                Use email: <span className="font-mono bg-white/10 px-2 py-1 rounded">test@example.com</span><br/>
                Password: <span className="font-mono bg-white/10 px-2 py-1 rounded">password123</span><br/>
                Admin email: <span className="font-mono bg-white/10 px-2 py-1 rounded">admin@example.com</span><br/>
                Admin password: <span className="font-mono bg-white/10 px-2 py-1 rounded">admin123</span>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}