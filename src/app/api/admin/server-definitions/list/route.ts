import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Proxy to Python Service
    // In production/serverless, we cannot read local filesystem for uploads.
    // We must query the Python service which holds the persistent files.
    const apiUrl = process.env.COPY_TRADING_API_URL || 'http://15.206.157.59:8000';
    const apiKey = process.env.COPY_TRADING_API_KEY || '';
    
    // Remove trailing slash
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const targetUrl = `${baseUrl}/server-definitions`;
    
    try {
      const response = await fetch(targetUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Python service returned ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform string array to object array to match expected frontend format
      const files = (data.files || []).map((filename: string) => ({
        name: filename,
        // We don't have size/date from Python simple list, but that's okay for now
        // We could enhance Python endpoint later if needed
        size: 0,
        lastModified: new Date().toISOString(),
        path: `/uploads/${filename}` 
      }));
      
      return NextResponse.json({ files });
      
    } catch (netError) {
      console.warn('Failed to fetch from Python service, falling back to empty list:', netError);
      // Fallback to empty list if service is down, rather than erroring out
      return NextResponse.json({ files: [] });
    }

  } catch (error: any) {
    console.error('Error listing server definitions:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
