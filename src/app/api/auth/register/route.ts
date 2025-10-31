import { NextResponse } from 'next/server';
import { registerUser } from '@/db/dbService';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Persist user to MySQL (dbService handles hashing and ID creation)
    const result = await registerUser({ name, email, password });

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