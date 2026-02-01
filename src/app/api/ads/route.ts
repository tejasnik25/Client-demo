import { NextRequest, NextResponse } from 'next/server';
import { getAds, createAd } from '@/db/dbService';

export async function GET() {
  try {
    const ads = await getAds();
    return NextResponse.json(ads);
  } catch (error) {
    console.error('Error fetching ads:', error);
    return NextResponse.json({ error: 'Failed to fetch ads' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, imageUrl, linkUrl, position, isActive } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const ad = await createAd({
      title,
      content,
      imageUrl,
      linkUrl,
      position: position || 'top',
      isActive: true
    });

    return NextResponse.json(ad, { status: 201 });
  } catch (error) {
    console.error('Error creating ad:', error);
    return NextResponse.json({ error: 'Failed to create ad' }, { status: 500 });
  }
}