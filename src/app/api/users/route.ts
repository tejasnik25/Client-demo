import { NextRequest, NextResponse } from 'next/server';

// GET /api/users - Get all users or a specific user
export async function GET(request: NextRequest) {
  try {
    // Get the user ID from the URL if provided
    const url = new URL(request.url);
    const userId = url.searchParams.get('id');
    
    // Use dynamic import to avoid client-side import issues
    const { getAllUsers, getUserById, readDatabase } = await import('../../../db/dbService');
    
    if (userId) {
      // Get a specific user
      const user = await getUserById(userId);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      // Merge enabled from JSON DB if present
      try {
        const db = readDatabase();
        const jsonUser = db.users.find((u: any) => u.id === userId);
        if (jsonUser && typeof jsonUser.enabled !== 'undefined') {
          (user as any).enabled = !!jsonUser.enabled;
        } else {
          (user as any).enabled = (user as any).enabled ?? true;
        }
      } catch (_) {
        (user as any).enabled = (user as any).enabled ?? true;
      }
      return NextResponse.json({ user });
    }
    
    // Get all users
    const users = await getAllUsers();
    // Add enabled flag for each user from JSON DB if present
    try {
      const db = readDatabase();
      const enabledMap = new Map<string, boolean>();
      for (const u of db.users) {
        enabledMap.set(u.id, typeof u.enabled !== 'undefined' ? !!u.enabled : true);
      }
      const merged = users.map((u: any) => ({
        ...u,
        enabled: typeof u.enabled !== 'undefined' ? !!u.enabled : (enabledMap.get(u.id) ?? true),
      }));
      return NextResponse.json({ users: merged });
    } catch (_) {
      return NextResponse.json({ users });
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/users - Reserved for future user updates
export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Method not implemented' }, { status: 501 });
}