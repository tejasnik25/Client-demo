'use client';

import { useState, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import UserLayout from '@/components/UserLayout';

const SimpleDashboardPageContent: React.FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [testMessage, setTestMessage] = useState('');

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Not Authenticated</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Please log in to access the dashboard.</p>
            <Button onClick={() => router.push('/login')} className="mt-4">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Simple Dashboard</h1>
      </div>
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Session Information</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2">Name: {session.user?.name}</p>
          <p className="mb-2">Email: {session.user?.email}</p>
          <p className="mb-2">Role: {session.user?.role}</p>
          {testMessage && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
              {testMessage}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Main page with UserLayout wrapper
const SimpleDashboardPageInner: React.FC = () => {
  return (
    <UserLayout>
      <SimpleDashboardPageContent />
    </UserLayout>
  );
};

const SimpleDashboardPage: React.FC = () => {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading dashboard...</div>}>
      <SimpleDashboardPageInner />
    </Suspense>
  );
};

export default SimpleDashboardPage;
