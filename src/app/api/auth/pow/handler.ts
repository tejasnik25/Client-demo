import { NextResponse } from 'next/server';
import { randomBytes, createHmac } from 'crypto';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'login';
  const salt = randomBytes(16).toString('hex');
  const issuedAt = Date.now();
  const difficulty = parseInt(process.env.POW_DIFFICULTY || '4', 10);
  const secret = process.env.NEXTAUTH_SECRET || 'your-secret-key';
  const sigBase = `${salt}:${issuedAt}:${difficulty}:${action}`;
  const signature = createHmac('sha256', secret).update(sigBase).digest('hex');
  return NextResponse.json({ salt, issuedAt, difficulty, action, signature });
}
