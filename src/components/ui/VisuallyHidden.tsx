import React, { type ReactNode } from 'react';

interface VisuallyHiddenProps {
  children: ReactNode;
  className?: string;
}

const VisuallyHidden = ({ children, className = '' }: VisuallyHiddenProps) => (
  <span className={`sr-only ${className}`}>
    {children}
  </span>
);

export default VisuallyHidden;