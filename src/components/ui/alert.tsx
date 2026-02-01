import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 text-sm [&>svg]:h-4 [&>svg]:w-4',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive: 'border-destructive bg-destructive/10 text-destructive dark:bg-destructive/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'destructive';
  }
>(({ className, variant, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {children}
    </div>
  );
});

Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn('font-medium leading-none tracking-tight', className)}
        {...props}
      >
        {children}
      </h3>
    );
  }
);

AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('text-sm [&_p]:leading-relaxed', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertDescription, AlertTitle };