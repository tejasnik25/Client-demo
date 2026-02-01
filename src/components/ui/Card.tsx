'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

const Card = ({ children, title, className = '' }: CardProps) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm overflow-hidden 
      border border-gray-200 
      ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

// Card subcomponents
const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`px-6 py-4 border-b border-gray-200 bg-gray-50 ${className || ''}`} {...props} />
);

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`text-xl font-semibold text-gray-900 ${className || ''}`} {...props} />
);

const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`text-sm text-gray-600 ${className || ''}`} {...props} />
);

const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-6 ${className || ''}`} {...props} />
);

const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`px-6 py-4 border-t border-gray-200 ${className || ''}`} {...props} />
);

export { CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
export default Card;
