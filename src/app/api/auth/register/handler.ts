import { NextResponse } from 'next/server';
import { registerUser } from '@/db/dbService';
import { createHash, createHmac } from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    type PowBody = {
      name: string;
      email: string;
      password: string;
      country_code?: string;
      country?: string;
      powSalt?: string;
      powIssuedAt?: string | number;
      powDifficulty?: string | number;
      powNonce?: string | number;
      powSignature?: string;
      powAction?: string;
    };
    const { name, email, password, country_code, country, powSalt, powIssuedAt, powDifficulty, powNonce, powSignature, powAction } = body as PowBody;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const secret = process.env.NEXTAUTH_SECRET || 'your-secret-key';
    if (!powSalt || !powIssuedAt || !powDifficulty || !powNonce || !powSignature) {
      return NextResponse.json({ error: 'Missing PoW' }, { status: 400 });
    }
    const issuedMs = typeof powIssuedAt === 'string' ? parseInt(powIssuedAt, 10) : Number(powIssuedAt);
    const diff = typeof powDifficulty === 'string' ? parseInt(powDifficulty, 10) : Number(powDifficulty);
    const action = typeof powAction === 'string' ? powAction : 'signup';
    if (!Number.isFinite(issuedMs) || !Number.isFinite(diff)) {
      return NextResponse.json({ error: 'Invalid PoW' }, { status: 400 });
    }
    const hash = createHash('sha256').update(`${powSalt}:${action}:${email}:${powNonce}`).digest('hex');
    const prefix = '0'.repeat(diff);
    if (!hash.startsWith(prefix)) {
      return NextResponse.json({ error: 'Insufficient PoW' }, { status: 400 });
    }

    // Validate PoW signature
    const sigBase = `${powSalt}:${issuedMs}:${diff}:${action}`;
    const sig = createHmac('sha256', secret).update(sigBase).digest('hex');
    if (sig !== powSignature) {
      return NextResponse.json({ error: 'Invalid PoW signature' }, { status: 400 });
    }
    
    if (Date.now() - issuedMs > 2 * 60 * 1000) {
      return NextResponse.json({ error: 'PoW expired' }, { status: 400 });
    }

    // Persist user to MySQL (dbService handles hashing and ID creation)
    const result = await registerUser({ name, email, password, country_code, country });

    if (!result.success || !result.user) {
      const status = result.error === 'User already exists' ? 409 : 500;
      return NextResponse.json({ error: result.error || 'Registration failed' }, { status });
    }

    return NextResponse.json(
      { success: true, message: 'User registered successfully', userId: result.user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'An internal server error occurred' }, { status: 500 });
  }
}
