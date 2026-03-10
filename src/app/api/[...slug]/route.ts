import { NextRequest, NextResponse } from 'next/server';

// Catch-all router for all non-admin APIs to stay under Vercel's 12-function limit.
export const dynamic = 'force-dynamic';

async function handleRequest(req: NextRequest, { params }: { params: { slug: string[] } }) {
  const slug = params.slug;
  const method = req.method;
  const path = slug.join('/');

  try {
    let handler: any;

    // Skip admin - it has its own catch-all
    if (slug[0] === 'admin') return NextResponse.json({ error: 'Use /api/admin/*' }, { status: 404 });
    // Skip auth - it has its own routes
    if (slug[0] === 'auth') {
       if (slug[1] === 'register') {
         handler = await import('../auth/register/handler');
       } else if (slug[1] === 'pow') {
         handler = await import('../auth/pow/handler');
       } else if (slug[1] === 'user') {
         handler = await import('../auth/user/handler');
       }
       if (handler && handler[method]) return (handler[method] as any)(req);
    }

    // 1. Simple paths (removed ads section)
    if (path === 'contact') handler = await import('../contact/handler');
    else if (path === 'email') handler = await import('../email/handler');
    else if (path === 'health') handler = await import('../health/handler');
    else if (path === 'plan-usage') handler = await import('../plan-usage/handler');
    else if (path === 'rate') handler = await import('../rate/handler');
    // else if (path === 'test-db') handler = await import('../test-db/handler');
    else if (path === 'upload-url') handler = await import('../upload-url/handler');
    else if (path === 'users') handler = await import('../users/handler');
    
    if (handler && handler[method]) return (handler[method] as any)(req);

    // 3. Copy Trading
    if (slug[0] === 'copy-trading') {
      if (slug[1] === 'connect') handler = await import('../copy-trading/connect/handler');
      else if (slug[1] === 'subscribe') handler = await import('../copy-trading/subscribe/handler');
      else if (slug[1] === 'unsubscribe') handler = await import('../copy-trading/unsubscribe/handler');
      if (handler && handler[method]) return (handler[method] as any)(req);
    }

    // 4. Payments
    if (slug[0] === 'payments') {
      if (slug.length === 2) {
        handler = await import('../payments/[id]/handler');
        if (handler && handler[method]) return (handler[method] as any)(req, { params: { id: slug[1] } });
      }
      handler = await import('../payments/handler');
      if (handler && handler[method]) return (handler[method] as any)(req);
    }

    // 5. Profile
    if (slug[0] === 'profile') {
      if (slug[1] === 'update') handler = await import('../profile/update/handler');
      else handler = await import('../profile/handler');
      if (handler && handler[method]) return (handler[method] as any)(req);
    }

    // 6. Public
    if (path === 'public/export-subscriptions') {
      handler = await import('../public/export-subscriptions/handler');
      if (handler && handler[method]) return (handler[method] as any)(req);
    }

    // 7. Running Strategies
    if (slug[0] === 'running-strategies') {
      if (slug.length === 3) {
        const sub = slug[2];
        if (sub === 'check-status') handler = await import('../running-strategies/[id]/check-status/handler');
        else if (sub === 'modification') handler = await import('../running-strategies/[id]/modification/handler');
        else if (sub === 'snapshot') handler = await import('../running-strategies/[id]/snapshot/handler');
        if (handler && handler[method]) return (handler[method] as any)(req, { params: { id: slug[1] } });
      }
      handler = await import('../running-strategies/handler');
      if (handler && handler[method]) return (handler[method] as any)(req);
    }

    // 8. Strategies
    if (slug[0] === 'strategies') {
      if (path === 'strategies/running') handler = await import('../strategies/running/handler');
      else if (path === 'strategies/upload') handler = await import('../strategies/upload/handler');
      else if (slug.length === 3 && slug[2] === 'master-history') {
        handler = await import('../strategies/[id]/master-history/handler');
        if (handler && handler[method]) return (handler[method] as any)(req, { params: { id: slug[1] } });
      }
      else if (slug.length === 2) {
        handler = await import('../strategies/[id]/handler');
        if (handler && handler[method]) return (handler[method] as any)(req, { params: { id: slug[1] } });
      }
      else handler = await import('../strategies/handler');
      if (handler && handler[method]) return (handler[method] as any)(req);
    }

    // 9. Wallet
    if (path === 'wallet/transactions') {
      handler = await import('../wallet/transactions/handler');
      if (handler && handler[method]) return (handler[method] as any)(req);
    }

    return NextResponse.json({ error: `Route not found: /api/${path}` }, { status: 404 });
  } catch (error: any) {
    console.error(`Error in catch-all API route (${path}):`, error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
