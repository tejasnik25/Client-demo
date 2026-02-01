// Direct test endpoint for loginUser function
import { NextResponse } from 'next/server';
import { loginUser } from '@/db/dbService';

// Simple endpoint to test loginUser function directly
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    
    console.log('=== Direct Login Test ===');
    console.log('Testing login with email:', email);
    
    // Call loginUser directly
    const result = await loginUser(email, password);
    
    console.log('Direct login test result:', result);
    
    return NextResponse.json({
      success: result.success,
      user: result.user,
      message: result.success ? 'Login successful' : 'Login failed'
    });
  } catch (error) {
    console.error('Error in direct login test:', error);
    return NextResponse.json({
      success: false,
      message: 'Error occurred during login test'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Please send a POST request with email and password to test login'
  });
}