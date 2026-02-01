import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { getAllUsers, createUserAdmin, deleteUserAdmin, updateUserAdmin } from '@/db/dbService';

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

    // Fetch all users from MySQL
    const users = await getAllUsers();
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
    const { name, email, password, role = 'USER', enabled = true } = data || {};
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }
    const result = await createUserAdmin({ name, email, password, role, enabled });
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to add user' }, { status: 400 });
    }
    return NextResponse.json({ user: result.user }, { status: 201 });
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

    const result = await deleteUserAdmin(userId);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to delete user' }, { status: 400 });
    }
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

    const result = await updateUserAdmin(id, {
      name: updateData.name,
      email: updateData.email,
      role: updateData.role,
      enabled: typeof updateData.enabled !== 'undefined' ? !!updateData.enabled : undefined,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update user' }, { status: 400 });
    }
    return NextResponse.json({ user: result.user });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}