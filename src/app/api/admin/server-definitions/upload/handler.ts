
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export const maxDuration = 20;

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
      const envUrl = process.env.COPY_TRADING_API_URL;
      const candidates = [];
      
      // 1. Env Var
      if (envUrl) candidates.push(envUrl);
      
      // 2. Public IP (AWS) - User preferred
      candidates.push('http://15.206.157.59:8000');
      
      // 3. Localhost (Fallback)
      if (!envUrl || !envUrl.includes('127.0.0.1')) {
          candidates.push('http://127.0.0.1:8000');
      }

      const apiKey = process.env.COPY_TRADING_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
      }
      
      let lastError;
      let successResponse;

      for (const apiUrl of candidates) {
          const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
          const targetUrl = `${baseUrl}/upload/server-definition`;
          
          console.log(`[API] Proxying upload to Python service: ${targetUrl}`);

          try {
              // Construct new FormData for the upstream request
              const pythonFormData = new FormData();
              pythonFormData.append('file', file);

              const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'x-api-key': apiKey,
                },
                body: pythonFormData,
                signal: AbortSignal.timeout(12000) // tighter 12s timeout to fit within function budget
              });

              if (response.ok) {
                  successResponse = await response.json();
                  break; // Success!
              } else {
                  const errorText = await response.text();
                  console.warn(`[API] Failed to upload to ${targetUrl}: ${response.status} ${errorText}`);
                  lastError = new Error(`Trading Service failed (${targetUrl}): ${errorText}`);
              }
          } catch (e: any) {
               console.warn(`[API] Connection failed to ${targetUrl}: ${e.message}`);
               lastError = e;
          }
      }

      if (successResponse) {
          return NextResponse.json({ 
            status: 'success', 
            message: `File uploaded to Trading Service successfully.`,
            details: successResponse
          });
      }

      throw lastError || new Error("All connection attempts failed.");

    } catch (netError: any) {
      console.error('[API] Python service connection failed:', netError);
      return NextResponse.json({ error: 'Trading Service unavailable' }, { status: 503 });
    }

  } catch (error: any) {
    console.error('[API] Upload Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
