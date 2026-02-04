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
    
    // Fallback API Key if env var fails to load (Temporary fix for local dev)
    const apiKey = process.env.COPY_TRADING_API_KEY || '9f236bab9fe640848a142f7d17a1960c8582d3ac18a96cc7ec86bb23c10ad6ad';
    
    // Remove trailing slash
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const targetUrl = `${baseUrl}/server-definitions`;
    
    console.log(`[API] Proxying list to Python service: ${targetUrl}`);
    console.log(`[API] Loaded API Key: ${process.env.COPY_TRADING_API_KEY ? 'Present (Env)' : 'Using Fallback'}`);

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'x-api-key': apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`Python service returned ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform string array or object array to match expected frontend format
      const files = (data.files || []).map((item: any) => {
        // Handle both old format (string[]) and new format ({name, size}[])
        const name = typeof item === 'string' ? item : item.name;
        const size = typeof item === 'string' ? 0 : (item.size || 0);
        
        return {
          name: name,
          size: size,
          lastModified: new Date().toISOString(),
          path: `/uploads/${name}` 
        };
      });
      
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
