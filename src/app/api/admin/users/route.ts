import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { readDatabase, writeDatabase } from '@/db/dbService';

// Helper function to check admin authorization
async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  
  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }
  
  return session;
}

export async function GET(_req: NextRequest) {
  try {
    // Check if user is authenticated and is an admin
    const session = await checkAdminAuth();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch all users from our mock database
    const db = readDatabase();
    
    // Format users according to expected structure
    const users = db.users.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role ?? 'USER',
      email_verified: user.email_verified ?? false,
      wallet_balance: typeof user.wallet_balance === 'number' ? user.wallet_balance : parseFloat(user.wallet_balance || '0'),
      stock_analysis_access: user.stock_analysis_access ?? false,
      analysis_count: user.analysis_count ?? 0,
      trial_expiry: user.trial_expiry ?? null,
      enabled: user.enabled ?? true,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await checkAdminAuth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { name, email, password, role = 'USER', walletBalance = 0, enabled = true } = data || {};

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    const db = readDatabase();
    const existing = db.users.find((u: any) => u.email === email);
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const newUser = {
      id: `user_${Date.now()}`,
      name,
      email,
      password,
      role,
      email_verified: null,
      wallet_balance: typeof walletBalance === 'number' ? walletBalance : parseFloat(walletBalance || '0'),
      stock_analysis_access: false,
      analysis_count: 0,
      trial_expiry: null,
      enabled,
      created_at: now,
      updated_at: now,
    };

    db.users.push(newUser);
    writeDatabase(db);

    const formatted = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role ?? 'USER',
      email_verified: newUser.email_verified ?? null,
      wallet_balance: newUser.wallet_balance,
      stock_analysis_access: newUser.stock_analysis_access,
      analysis_count: newUser.analysis_count,
      trial_expiry: newUser.trial_expiry,
      enabled: newUser.enabled ?? true,
      created_at: newUser.created_at,
      updated_at: newUser.updated_at,
    };

    return NextResponse.json({ user: formatted }, { status: 201 });
  } catch (error) {
    console.error('Error adding user:', error);
    return NextResponse.json({ error: 'Failed to add user' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Check if user is authenticated and is an admin
    const session = await checkAdminAuth();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the user ID from the URL
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Prevent deleting the admin user (hardcoded admin ID)
    if (userId === 'admin123') {
      return NextResponse.json(
        { error: 'Cannot delete the admin account' },
        { status: 400 }
      );
    }

    // Delete the user from our mock database
    const db = readDatabase();
    const userIndex = db.users.findIndex((user: { id: string }) => user.id === userId);
    
    if (userIndex === -1) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Remove the user
    db.users.splice(userIndex, 1);
    writeDatabase(db);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // Check if user is authenticated and is an admin
    const session = await checkAdminAuth();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the user data from the request body
    const data = await req.json();
    const { id, ...updateData } = data;

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Prevent updating the admin user
    if (id === 'admin123') {
      return NextResponse.json(
        { error: 'Cannot update the admin account' },
        { status: 400 }
      );
    }

    // Update the user in our mock database
    const db = readDatabase();
    const userIndex = db.users.findIndex((user: { id: string }) => user.id === id);
    
    if (userIndex === -1) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Update user fields (convert camelCase to snake_case for our mock DB)
    const user = db.users[userIndex];
    
    if (updateData.name) user.name = updateData.name;
    if (updateData.email) user.email = updateData.email;
    if (updateData.role) user.role = updateData.role;
    if (typeof updateData.enabled !== 'undefined') user.enabled = !!updateData.enabled;
    // Wallet balance field removed
    user.updated_at = new Date().toISOString();
    
    writeDatabase(db);
    
    // Format the response to match expected structure (same as GET)
    const formatted = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role ?? 'USER',
      email_verified: user.email_verified ?? null,
      wallet_balance: null, // Wallet functionality removed
      stock_analysis_access: user.stock_analysis_access ?? false,
      analysis_count: user.analysis_count ?? 0,
      trial_expiry: user.trial_expiry ?? null,
      enabled: user.enabled ?? true,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    return NextResponse.json({ user: formatted });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}