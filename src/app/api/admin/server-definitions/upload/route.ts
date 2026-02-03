
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

    // 3. Prepare Forward Request to Python Service
    // We need to construct a new FormData to send to the Python backend
    const pythonFormData = new FormData();
    pythonFormData.append('file', file);

    const apiUrl = process.env.COPY_TRADING_API_URL || 'http://127.0.0.1:8000';
    const apiKey = process.env.COPY_TRADING_API_KEY || '';

    // Remove trailing slash
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const targetUrl = `${baseUrl}/upload/server-definition`;

    console.log(`[API] Forwarding .srv upload to: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey, // Assuming Python uses verify_api_key which checks x-api-key or query param
        // Note: Do NOT set Content-Type header when using FormData, fetch sets it with boundary automatically
      },
      body: pythonFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Python Service Error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Trading Service failed: ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[API] Upload Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
