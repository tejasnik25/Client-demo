'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { validateEmail, validatePassword } from '@/utils/auth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    password: '',
    general: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    let valid = true;
    const newErrors = { ...errors };

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
      valid = false;
    }

    if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email';
      valid = false;
    }

    if (!validatePassword(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters';
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setIsLoading(true);
      setErrors(prev => ({ ...prev, general: '' }));
      
      // Register user using our API
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'register',
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.status === 409) {
        setErrors(prev => ({ ...prev, email: 'Email already exists. Please use a different email.' }));
        setIsLoading(false);
        return;
      }

      if (response.status !== 201) {
        throw new Error(data.error || 'Failed to register user.');
      }

      // Sign in the user after successful registration
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setErrors(prev => ({ ...prev, general: 'Registration successful but failed to log in. Please go to login page.' }));
      } else {
        // Redirect to dashboard after successful registration and login
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error signing up:', error);
      setErrors(prev => ({ ...prev, general: (error as Error).message || 'Failed to register. Please try again.' }));
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex items-center justify-center p-4 auth-gradient-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            Stock Analysis
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Create your account
          </p>
        </div>

        <Card className="w-full auth-card">
          <form onSubmit={handleSignUp} className="space-y-4">
            {errors.general && (
              <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-300">
                {errors.general}
              </div>
            )}
            <Input
              label="Full Name"
              type="text"
              name="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              required
            />
            <Input
              label="Email Address"
              type="email"
              name="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              required
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
            />
            <Button
              type="submit"
              className="w-full mt-6 auth-button"
              isLoading={isLoading}
            >
              Sign Up
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <p className="text-gray-600 dark:text-gray-300">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
                Log in
              </Link>
            </p>
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
              <p className="text-yellow-800 dark:text-yellow-300 font-medium">Testing Information</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                After signup, you&#39;ll be redirected to the login page.<br/>
                Check the <Link href="/admin" className="text-blue-600 dark:text-blue-400 underline">admin page</Link> to see all test accounts.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}