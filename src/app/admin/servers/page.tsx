'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ServerDefinitionUpload from '@/components/admin/ServerDefinitionUpload';
import { FiArrowLeft, FiRefreshCw, FiServer, FiHardDrive } from 'react-icons/fi';
import Link from 'next/link';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';

interface ServerDefinition {
  name: string;
  size: number;
  lastModified: string;
  path: string;
}

export default function AdminServersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [servers, setServers] = useState<ServerDefinition[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    
    const isAdminSessionActive = typeof window !== 'undefined' && 
                               localStorage.getItem('adminSessionActive') === 'true';
    
    if (status === 'unauthenticated') {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('adminSessionActive');
      }
      router.push('/admin-login');
    } else if (status === 'authenticated') {
      if (isAdminSessionActive && session?.user?.role !== 'ADMIN') {
        alert('Admin session has expired or been replaced. Redirecting to user dashboard.');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('adminSessionActive');
        }
        router.push('/dashboard');
      }
      else if (!isAdminSessionActive && session?.user?.role !== 'ADMIN') {
        router.push('/dashboard');
      }
    }
  }, [session, status, router]);

  const fetchServers = async () => {
    setIsLoadingServers(true);
    try {
      const res = await fetch('/api/admin/server-definitions/list');
      if (res.ok) {
        const data = await res.json();
        setServers(data.files || []);
      }
    } catch (error) {
      console.error('Failed to fetch servers', error);
    } finally {
      setIsLoadingServers(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      fetchServers();
    }
  }, [status, session]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (status === 'unauthenticated' || (session?.user?.role !== 'ADMIN')) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-6">
        <Link href="/admin" className="mr-4 text-gray-600 hover:text-gray-900">
          <FiArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <FiHardDrive className="mr-3" />
          Server Management
        </h1>
      </div>
      
      <div className="grid gap-6">
        <ServerDefinitionUpload />
        
        <Card className="bg-white border border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Connected Servers</CardTitle>
                  <CardDescription>List of broker servers currently recognized by the system (.srv files).</CardDescription>
                </div>
                <button 
                  onClick={fetchServers} 
                  disabled={isLoadingServers}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  title="Refresh List"
                >
                  <FiRefreshCw className={`h-5 w-5 ${isLoadingServers ? 'animate-spin' : ''}`} />
                </button>
            </CardHeader>
            <CardContent>
                {isLoadingServers ? (
                  <div className="text-center py-8 text-gray-500">Loading servers...</div>
                ) : servers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <FiServer className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p>No custom server definitions found.</p>
                    <p className="text-xs mt-1">Upload a .srv file to get started.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3">Server File Name</th>
                          <th scope="col" className="px-6 py-3">Size</th>
                          <th scope="col" className="px-6 py-3">Last Modified</th>
                        </tr>
                      </thead>
                      <tbody>
                        {servers.map((server) => (
                          <tr key={server.name} className="bg-white border-b hover:bg-gray-50">
                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap flex items-center">
                              <FiServer className="mr-2 text-blue-500" />
                              {server.name}
                            </td>
                            <td className="px-6 py-4">
                              {(server.size / 1024).toFixed(2)} KB
                            </td>
                            <td className="px-6 py-4">
                              {new Date(server.lastModified).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
