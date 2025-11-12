'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { validateEmail, validatePassword } from '@/utils/auth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import '@/styles/vuexy-theme.css';

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
    <div className="vuexy-auth-wrapper">
      <div className="vuexy-auth-card">
        {/* Left: Illustration */}
        <div className="vuexy-auth-illustration">
          <h2 className="text-2xl font-semibold text-center mb-2 text-[#7367f0]">
            Join Copy Trading
          </h2>
          <p className="text-center text-gray-600 max-w-md">
            Start tracking your positions with smart insights and maximize your trading potential.
          </p>
        </div>
        
        {/* Right: Signup form */}
        <div className="vuexy-auth-inner">
          <div className="vuexy-auth-brand">
            <Image 
              src="/logo.svg" 
              alt="Copy Trade Logo" 
              width={36} 
              height={36} 
            />
          </div>
          
          <h2 className="vuexy-auth-title text-center">Adventure starts here 🚀</h2>
          <p className="vuexy-auth-subtitle text-center">
            Make your trading management easy and fun!
          </p>
          
          <form onSubmit={handleSignUp}>
            {errors.general && (
              <div className="p-3 mb-4 text-sm text-red-500 bg-red-50 rounded-lg border border-red-200 flex items-center">
                {errors.general}
              </div>
            )}
            
            <div className="vuexy-form-group">
              <label className="vuexy-form-label" htmlFor="name">Full Name</label>
              <Input
                id="name"
                type="text"
                name="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                error={errors.name}
                required
                className="vuexy-form-control"
              />
              {errors.name && <div className="vuexy-error-msg">{errors.name}</div>}
            </div>
            
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
              <label className="vuexy-form-label" htmlFor="password">Password</label>
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
                id="terms"
                name="terms"
                type="checkbox"
                className="vuexy-checkbox"
              />
              <label htmlFor="terms" className="ml-2 text-sm text-gray-600">
                I agree to <Link href="#" className="vuexy-link">privacy policy & terms</Link>
              </label>
            </div>
            
            <Button
              type="submit"
              className="vuexy-btn vuexy-btn-primary vuexy-btn-block"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Sign up'}
            </Button>
          </form>
          
          <div className="vuexy-auth-footer-text">
            <p>
              Already have an account? 
              <Link href="/login" className="vuexy-link ml-1">
                Sign in instead
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}