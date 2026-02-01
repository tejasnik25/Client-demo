import React, { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const textareaVariants = cva(
  'flex min-h-[80px] w-full rounded-md border border-black bg-white px-3 py-2 text-sm text-black ring-offset-background placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d09c] focus-visible:ring-offset-2 focus-visible:border-black disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      error: {
        true: 'border-red-500 focus-visible:ring-red-500',
      },
    },
  }
);

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  className,
  label,
  error,
  ...props
}, ref) => {
  return (
    <div className="space-y-1">
      {label && <label htmlFor={props.id} className="text-sm font-medium">{label}</label>}
      <textarea
        ref={ref}
        className={cn(textareaVariants({ error: !!error }), className)}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;