import { NextRequest, NextResponse } from 'next/server';

// This is a catch-all route for Admin APIs to save serverless function count on Vercel Hobby Plan.
export const dynamic = 'force-dynamic';

async function handleRequest(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const method = req.method;

  try {
    let handler: any;

    // 1. Static paths
    if (slug.length === 1) {
      const path = slug[0];
      if (path === 'analytics') handler = await import('../analytics/handler');
      else if (path === 'init-db') handler = await import('../init-db/handler');
      else if (path === 'strategies') handler = await import('../strategies/handler');
      else if (path === 'sync') handler = await import('../sync/handler');
      else if (path === 'sync-strategies') handler = await import('../sync-strategies/handler');
      else if (path === 'users') handler = await import('../users/handler');
      else if (path === 'transactions') handler = await import('../transactions/handler');
      else if (path === 'running-strategies') handler = await import('../running-strategies/handler');
      else if (path === 'profit-sharing') handler = await import('../profit-sharing/handler');
      
      if (handler && handler[method]) return (handler[method] as any)(req);
    }

    // 2. /payments/...
    if (slug[0] === 'payments') {
      if (slug[1] === 'approved') handler = await import('../payments/approved/handler');
      else if (slug[1] === 'pending') handler = await import('../payments/pending/handler');
      else if (slug.length === 3) {
        const action = slug[2];
        if (action === 'approve') handler = await import('../payments/[id]/approve/handler');
        else if (action === 'message') handler = await import('../payments/[id]/message/handler');
        else if (action === 'reject') handler = await import('../payments/[id]/reject/handler');
        if (handler && handler[method]) return (handler[method] as any)(req, { params: { id: slug[1] } });
      }
      if (handler && handler[method]) return (handler[method] as any)(req);
    }

    // 3. /running-strategies/...
    if (slug[0] === 'running-strategies') {
      if (slug[1] === 'modifications') {
        if (slug.length === 4) {
          const modId = slug[2];
          const action = slug[3];
          if (action === 'approve') handler = await import('@/app/api/admin/running-strategies/modifications/[id]/approve/handler');
          else if (action === 'reject') handler = await import('@/app/api/admin/running-strategies/modifications/[id]/reject/handler');
          if (handler && handler[method]) return (handler[method] as any)(req, { params: { id: modId } });
        }
        handler = await import('@/app/api/admin/running-strategies/modifications/handler');
      }
      else if (slug.length === 3) {
        const sub = slug[2];
        if (sub === 'details') handler = await import('@/app/api/admin/running-strategies/[id]/details/handler');
        else if (sub === 'reconnect') handler = await import('@/app/api/admin/running-strategies/[id]/reconnect/handler');
        else if (sub === 'status') handler = await import('@/app/api/admin/running-strategies/[id]/status/handler');
        if (handler && handler[method]) return (handler[method] as any)(req, { params: { id: slug[1] } });
      }
      if (handler && handler[method]) return (handler[method] as any)(req);
    }

    // 3.5 /strategies/:id/backfill-trades
    if (slug[0] === 'strategies' && slug.length === 3 && slug[2] === 'backfill-trades') {
      const id = slug[1];
      handler = await import('../strategies/[id]/backfill-trades/handler');
      if (handler && handler[method]) return (handler[method] as any)(req, { params: { id } });
    }

    // 4. /server-definitions/...
    if (slug[0] === 'server-definitions') {
      if (slug[1] === 'list') handler = await import('../server-definitions/list/handler');
      else if (slug[1] === 'upload') handler = await import('../server-definitions/upload/handler');
      if (handler && handler[method]) return (handler[method] as any)(req);
    }

    // 5. /transactions/...
    if (slug[0] === 'transactions') {
      if (slug[1] === 'update') handler = await import('../transactions/update/handler');
      else if (slug.length === 2) {
        handler = await import('../transactions/[id]/handler');
        if (handler && handler[method]) return (handler[method] as any)(req, { params: { id: slug[1] } });
      }
      if (handler && handler[method]) return (handler[method] as any)(req);
    }

    return NextResponse.json({ error: `Route not found: /api/admin/${slug.join('/')}` }, { status: 404 });
  } catch (error: any) {
    console.error(`Error in catch-all admin route (${slug.join('/')}):`, error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
