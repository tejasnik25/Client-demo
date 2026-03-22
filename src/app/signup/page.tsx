'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { validateEmail, validatePassword } from '@/utils/auth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import '@/styles/vuexy-theme.css';

import { COUNTRY_OPTIONS } from '@/utils/countries';

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
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
    name: '',
    email: '',
    password: '',
    phone: '',
    countryCode: '+91',
    country: 'India',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    password: '',
    general: '',
    phone: '',
    countryCode: '',
    country: '',
  });
  const [countryCodeSearch, setCountryCodeSearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      let digits = value.replace(/\D/g, '');
      const selected = COUNTRY_OPTIONS.find(c => c.name === formData.country);
      if (selected && digits.length > selected.maxLength) {
        digits = digits.slice(0, selected.maxLength);
      }
      setFormData(prev => ({ ...prev, phone: digits }));
      setErrors(prev => ({ ...prev, phone: '' }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
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

    const phoneDigits = formData.phone.replace(/\D/g, '');
    const selected = COUNTRY_OPTIONS.find(c => c.name === formData.country);
    if (!phoneDigits) {
      newErrors.phone = 'Mobile number is required';
      valid = false;
    } else if (selected) {
      if (phoneDigits.length < selected.maxLength) {
        newErrors.phone = `Mobile number must be ${selected.maxLength} digits. You entered ${phoneDigits.length}.`;
        valid = false;
      } else if (phoneDigits.length > selected.maxLength) {
        newErrors.phone = `Mobile number cannot be more than ${selected.maxLength} digits.`;
        valid = false;
      }
    } else {
      if (phoneDigits.length < 6) {
        newErrors.phone = 'Mobile number is too short.';
        valid = false;
      } else if (phoneDigits.length > 15) {
        newErrors.phone = 'Mobile number is too long.';
        valid = false;
      }
    }

    if (!formData.countryCode) {
      newErrors.countryCode = 'Country code is required';
      valid = false;
    }

    if (!formData.country) {
      newErrors.country = 'Country is required';
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
      
      const phoneDigits = formData.phone.replace(/\D/g, '');

      const powReg = await solvePow('signup', formData.email);
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
          phone: phoneDigits,
          country_code: formData.countryCode,
          country: formData.country,
          powSalt: powReg.salt,
          powIssuedAt: powReg.issuedAt,
          powDifficulty: powReg.difficulty,
          powNonce: powReg.nonce,
          powSignature: powReg.signature,
          powAction: powReg.action,
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

      // Sign in the user after successful registration (reuses the same page captcha if available)
      const powLogin = await solvePow('login', formData.email);
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        powSalt: powLogin.salt,
        powIssuedAt: powLogin.issuedAt,
        powDifficulty: powLogin.difficulty,
        powNonce: powLogin.nonce,
        powSignature: powLogin.signature,
        powAction: powLogin.action,
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

  const filteredCountryCodeOptions = COUNTRY_OPTIONS.filter(option => {
    const query = countryCodeSearch.toLowerCase();
    if (!query) return true;
    return (
      option.code.toLowerCase().includes(query) ||
      option.name.toLowerCase().includes(query)
    );
  });

  const filteredCountryOptions = COUNTRY_OPTIONS.filter(option => {
    const query = countrySearch.toLowerCase();
    if (!query) return true;
    return (
      option.name.toLowerCase().includes(query) ||
      option.code.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 sm:px-0">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 space-y-6 sm:space-y-8 shadow-lg">
        <div className="flex justify-center mb-6">
          <Image 
            src="/Signals Copy - Logo.png" 
            alt="Signals Copy" 
            width={240} 
            height={80} 
            className="object-contain" 
            quality={100}
            priority
          />
        </div>
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-black">
            Create an account
          </h2>
          <p className="mt-2 text-sm text-black">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in
            </Link>
          </p>
        </div>
        
        <form className="mt-6 sm:mt-8 space-y-6" onSubmit={handleSignUp}>
          {errors.general && (
            <div className="p-3 mb-4 text-sm text-red-500 bg-red-50 rounded-lg border border-red-200 flex items-center">
              {errors.general}
            </div>
          )}
          
          <div className="space-y-4">
  <div>
    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
      Full Name
    </label>
    <Input
      id="name"
      name="name"
      type="text"
      autoComplete="name"
      required
      className="appearance-none relative block w-full px-3 py-2 h-10 border border-gray-300 placeholder-gray-400 text-black rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
      placeholder="Full Name"
      value={formData.name}
      onChange={handleChange}
      error={errors.name}
    />
  </div>
  <div>
    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
      Email address
    </label>
    <Input
      id="email"
      name="email"
      type="email"
      autoComplete="email"
      required
      className="appearance-none relative block w-full px-3 py-2 h-10 border border-gray-300 placeholder-gray-400 text-black rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
      placeholder="Email address"
      value={formData.email}
      onChange={handleChange}
      error={errors.email}
    />
  </div>
  <div>
    <label htmlFor="password" title="Password" className="block text-sm font-medium text-gray-700 mb-1">
      Password
    </label>
    <div className="relative">
      <Input
        id="password"
        name="password"
        type={showPassword ? "text" : "password"}
        autoComplete="new-password"
        required
        className="appearance-none relative block w-full px-3 py-2 h-10 border border-gray-300 placeholder-gray-400 text-black rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm pr-10"
        placeholder="Password"
        value={formData.password}
        onChange={handleChange}
        error={errors.password}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-20"
      >
        {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
      </button>
    </div>
  </div>
</div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-black">Country</label>
              <Select
                value={formData.country}
                onValueChange={(value) => {
                  const selected = COUNTRY_OPTIONS.find(c => c.name === value);
                  setFormData(prev => {
                    const nextSelected = COUNTRY_OPTIONS.find(c => c.name === value);
                    const maxLen = nextSelected?.maxLength ?? 10;
                    const digits = prev.phone.replace(/\D/g, '');
                    const limitedDigits =
                      nextSelected && digits.length > nextSelected.maxLength
                        ? digits.slice(0, nextSelected.maxLength)
                        : digits;
                    return {
                      ...prev,
                      country: value,
                      countryCode: selected ? selected.code : prev.countryCode,
                      phone: limitedDigits,
                    };
                  });
                  setErrors(prev => ({ ...prev, country: '', countryCode: '', phone: '' }));
                }}
              >
                <SelectTrigger className="bg-white border-gray-300 text-black">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={e => setCountrySearch(e.target.value)}
                      placeholder="Search country"
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {filteredCountryOptions.map((option, index) => (
                    <SelectItem
                      key={`${option.code}-${option.name}-${index}`}
                      value={option.name}
                    >
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.country && (
                <p className="mt-1 text-sm text-red-500">{errors.country}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-black">Mobile number</label>
              <div className="flex gap-2">
                <div className="w-24 sm:w-28">
                  <Select
                    value={formData.countryCode}
                    onValueChange={(value) => {
                      const selected = COUNTRY_OPTIONS.find(c => c.code === value);
                      setFormData(prev => {
                        const nextSelected = COUNTRY_OPTIONS.find(c => c.code === value);
                        const maxLen = nextSelected?.maxLength ?? 10;
                        const digits = prev.phone.replace(/\D/g, '');
                        const limitedDigits =
                          digits.length > maxLen ? digits.slice(0, maxLen) : digits;
                        return {
                          ...prev,
                          countryCode: value,
                          country: selected ? selected.name : prev.country,
                          phone: limitedDigits,
                        };
                      });
                      setErrors(prev => ({ ...prev, countryCode: '', country: '', phone: '' }));
                    }}
                  >
                    <SelectTrigger className="bg-white border-gray-300 text-black">
                      <SelectValue placeholder="+91" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-2">
                        <input
                          type="text"
                          value={countryCodeSearch}
                          onChange={e => setCountryCodeSearch(e.target.value)}
                          placeholder="Search code or country"
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      {filteredCountryCodeOptions.map((option, index) => (
                        <SelectItem
                          key={`${option.code}-${option.name}-${index}`}
                          value={option.code}
                        >
                          {option.code} ({option.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.countryCode && (
                    <p className="mt-1 text-sm text-red-500">{errors.countryCode}</p>
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    className="appearance-none relative block w-full px-3 py-2 h-10 border border-gray-300 placeholder-gray-500 text-black rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Mobile number"
                    value={formData.phone}
                    onChange={handleChange}
                    error={errors.phone}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              required
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="terms" className="ml-2 block text-sm text-black">
              I agree to the{' '}
              <Link href="#" className="font-medium text-blue-600 hover:text-blue-500">
                Terms of Service
              </Link>
            </label>
          </div>

          <div>
            <Button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Sign up'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
