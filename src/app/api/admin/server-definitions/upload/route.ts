
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function POST(req: NextRequest) {
  try {
    // 1. Check Auth
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get File from Request
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.srv') && !file.name.endsWith('.dat')) {
      return NextResponse.json({ error: 'Only .srv or .dat files are allowed' }, { status: 400 });
    }

    // 3. Proxy to Python Service
    // We CANNOT save locally in Vercel/Production (EROFS error).
    // So we MUST forward it to the Python service which has persistent storage.
    try {
      const apiUrl = process.env.COPY_TRADING_API_URL || 'http://15.206.157.59:8000';
      const apiKey = process.env.COPY_TRADING_API_KEY || '';
      
      // Remove trailing slash
      const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
      const targetUrl = `${baseUrl}/upload/server-definition`;
      
      console.log(`[API] Proxying upload to Python service: ${targetUrl}`);

      // Construct new FormData for the upstream request
      const pythonFormData = new FormData();
      pythonFormData.append('file', file);

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          // Do NOT set Content-Type header manually when using FormData
          // The browser/fetch client will set it with the boundary
        },
        body: pythonFormData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API] Python service rejected upload: ${response.status} ${errorText}`);
        return NextResponse.json(
          { error: `Trading Service failed: ${errorText}` },
          { status: response.status }
        );
      }

      const result = await response.json();
      
      return NextResponse.json({ 
        status: 'success', 
        message: `File uploaded to Trading Service successfully.`,
        details: result
      });

    } catch (netError: any) {
      console.error('[API] Python service connection failed:', netError);
      return NextResponse.json(
        { error: `Could not connect to Trading Service: ${netError.message}` },
        { status: 503 }
      );
    }

  } catch (error: any) {
    console.error('[API] Upload Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
