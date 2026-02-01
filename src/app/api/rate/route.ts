import { NextResponse } from 'next/server';

// Server-side proxy to fetch USD→INR in real-time with env fallback
export async function GET() {
  try {
    // Allow override via env for fallback/default
    const envRate = process.env.NEXT_PUBLIC_USD_TO_INR_RATE || process.env.USD_TO_INR_RATE;
    const fallbackRate = envRate ? parseFloat(envRate) : undefined;

    // Source endpoint configurable via env
    const source = process.env.EXCHANGE_RATE_API_URL || 'https://api.exchangerate.host/latest';
    const url = `${source}?base=USD&symbols=INR`;

    let rate: number | undefined = undefined;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const live = data?.rates?.INR;
        if (typeof live === 'number' && live > 0) rate = live;
      }
    } catch {
      // Ignore network error and use fallback below
    }

    if (typeof rate !== 'number') {
      rate = typeof fallbackRate === 'number' && fallbackRate > 0 ? fallbackRate : 83;
    }

    return NextResponse.json({ base: 'USD', symbol: 'INR', rate });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch rate' }, { status: 500 });
  }
}