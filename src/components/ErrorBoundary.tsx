'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import Button from '@/components/ui/Button';
import Card, { CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <Card className="w-full max-w-md mx-auto mt-10">
          <CardHeader>
            <CardTitle className="text-red-600">Something went wrong</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              An error occurred while rendering this component.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {this.state.error.message}
              </pre>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={() => window.location.reload()}
              variant="outline"
            >
              Reload Page
            </Button>
          </CardFooter>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;