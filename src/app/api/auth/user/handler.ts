import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { action, name, email, password } = await request.json();
    
    // Use dynamic import to avoid client-side import issues
    const dbService = await import('../../../../db/dbService');
    
    if (action === 'register') {
      const result = await dbService.createUser(name, email, password);
      return NextResponse.json(result);
    }
    
    if (action === 'login') {
      const result = await dbService.loginUser(email, password);
      return NextResponse.json(result);
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in user API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process user request' },
      { status: 500 }
    );
  }
}