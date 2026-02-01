'use client';

import React, { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'default';
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', isLoading = false, size = 'md', className = '', leftIcon, ...props }, ref) => {
    const sizeStyles = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-6 py-3',
      lg: 'px-8 py-4 text-lg'
    };

    const baseStyles = `${sizeStyles[size]} rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2`;
    
    const variantStyles = {
      primary: 'bg-gradient-to-r from-[#00b085] to-[#009e72] hover:from-[#009e72] hover:to-[#00b085] text-white focus:ring-green-600',
      secondary: 'bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white focus:ring-pink-500',
      outline: 'border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-gray-500',
      default: 'bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 focus:ring-gray-500'
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${className} ${isLoading ? 'opacity-70 cursor-not-allowed' : ''} ${leftIcon ? 'flex items-center gap-2' : ''}`}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading...
          </div>
        ) : (
          <>
            {leftIcon && leftIcon}
            {children}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
