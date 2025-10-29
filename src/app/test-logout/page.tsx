'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import UserLayout from '@/components/UserLayout';

const TestLogoutPageContent: React.FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const handleLogout = async () => {
    try {
      // Direct API call to ensure logout
      await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
      });
      // Clear client-side storage
      sessionStorage.clear();
      localStorage.clear();
      // Redirect to landing page
      router.push('/');
    } catch (error) {
      console.error('Error during logout:', error);
      // Fallback logout method
      router.push('/');
    }
  };

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6 sm:px-6 lg:px-8 flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Logout Test Page</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Session status: {status}</p>
          {session ? (
            <p>You are logged in as: {session.user?.email}</p>
          ) : (
            <p>You are not logged in</p>
          )}
          <Button onClick={handleLogout} className="w-full">
            Test Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// Main page with UserLayout wrapper
const TestLogoutPage: React.FC = () => {
  return (
    <UserLayout>
      <TestLogoutPageContent />
    </UserLayout>
  );
};

export default TestLogoutPage;