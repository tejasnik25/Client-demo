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
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2 hover:bg-white rounded-full transition-all border border-transparent hover:border-gray-200 text-gray-600">
              <FiArrowLeft className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase flex items-center gap-3">
                <FiHardDrive className="text-[#00d09c]" />
                Server Management
              </h1>
              <p className="text-sm font-medium text-gray-500 mt-1">Configure and manage MT broker server definitions</p>
            </div>
          </div>
          <button 
            onClick={fetchServers} 
            disabled={isLoadingServers}
            className="flex items-center justify-center gap-2 h-11 px-6 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-xs font-black uppercase tracking-wider text-gray-600 shadow-sm"
          >
            <FiRefreshCw className={`h-4 w-4 ${isLoadingServers ? 'animate-spin' : ''}`} />
            Refresh List
          </button>
        </div>
        
        <div className="grid gap-8">
          <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden p-8">
            <ServerDefinitionUpload />
          </div>
          
          <Card className="bg-white border-gray-100 shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="p-8 border-b border-gray-50">
              <CardTitle className="text-lg font-black text-gray-900 uppercase tracking-tight">Connected Broker Servers</CardTitle>
              <CardDescription className="text-xs font-medium text-gray-400">List of authorized broker server definitions (.srv files) currently recognized by the trading engine.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                {isLoadingServers ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-[#00d09c] mb-4" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading definitions...</p>
                  </div>
                ) : servers.length === 0 ? (
                  <div className="text-center py-20 px-8">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                      <FiServer className="h-8 w-8 text-gray-300" />
                    </div>
                    <h3 className="text-sm font-black text-gray-900 uppercase">No definitions found</h3>
                    <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto">Upload a .srv file from your MT terminal to allow the system to connect to your broker.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                          <th className="px-8 py-4">Server File Name</th>
                          <th className="px-8 py-4">Size</th>
                          <th className="px-8 py-4">Last Modified</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {servers.map((server) => (
                          <tr key={server.name} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-110 transition-transform">
                                  <FiServer className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-black text-gray-900">{server.name}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <span className="text-xs font-bold text-gray-500">{(server.size / 1024).toFixed(2)} KB</span>
                            </td>
                            <td className="px-8 py-5">
                              <span className="text-xs font-bold text-gray-500">{new Date(server.lastModified).toLocaleString()}</span>
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
    </div>
  );
}
