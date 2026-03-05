import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById } from '../../../../db/dbService';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const strategy = await getStrategyById(id);

  if (!strategy) {
    return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
  }

  // If we have a BLOB, serve it with correct headers
  if (strategy.contentBlob && strategy.contentMime) {
    const buffer = Buffer.from(strategy.contentBlob); // convert ArrayBuffer -> Buffer
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': strategy.contentMime,
        'Cache-Control': 'public, max-age=3600',
        'Content-Disposition': `inline; filename="strategy-${id}.${strategy.contentMime.includes('pdf') ? 'pdf' : 'html'}"`,
      },
    });
  }

  // If we have an external URL, redirect to it
  if (strategy.contentUrl) {
    return NextResponse.redirect(strategy.contentUrl, 302);
  }

  return NextResponse.json({ error: 'No content available' }, { status: 404 });
}