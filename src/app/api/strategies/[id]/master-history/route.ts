import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById } from '@/db/dbService';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const strategy = await getStrategyById(id);

  if (!strategy) {
    return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
  }

  const masterId = strategy.masterAccountId;
  if (!masterId) {
    return NextResponse.json({ error: 'Master ID not found for this strategy' }, { status: 404 });
  }

  const apiUrl = process.env.COPY_TRADING_API_URL || 'http://15.206.157.59:8000';
  const apiKey = process.env.COPY_TRADING_API_KEY || '9f236bab9fe640848a142f7d17a1960c8582d3ac18a96cc7ec86bb23c10ad6ad';

  try {
    const response = await fetch(`${apiUrl}/master/${masterId}/history`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json({ error: errorData.detail || 'Failed to fetch history from trading service' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching master history:', error);
    return NextResponse.json({ error: 'Connection to trading service failed' }, { status: 500 });
  }
}
