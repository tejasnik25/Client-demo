import { NextRequest, NextResponse } from 'next/server';
import { getAdById, updateAd, deleteAd } from '@/db/dbService';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ad = await getAdById(params.id);
    if (!ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    }
    return NextResponse.json(ad);
  } catch (error) {
    console.error('Error fetching ad:', error);
    return NextResponse.json({ error: 'Failed to fetch ad' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const ad = await updateAd(params.id, body);
    if (!ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    }
    return NextResponse.json(ad);
  } catch (error) {
    console.error('Error updating ad:', error);
    return NextResponse.json({ error: 'Failed to update ad' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const ad = await updateAd(params.id, body);
    if (!ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    }
    return NextResponse.json(ad);
  } catch (error) {
    console.error('Error updating ad:', error);
    return NextResponse.json({ error: 'Failed to update ad' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const success = await deleteAd(params.id);
    if (!success) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Ad deleted successfully' });
  } catch (error) {
    console.error('Error deleting ad:', error);
    return NextResponse.json({ error: 'Failed to delete ad' }, { status: 500 });
  }
}