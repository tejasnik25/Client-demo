import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth-options';
import { getUserById } from '@/db/dbService';

export async function GET(req: NextRequest) {
  try {
    let session = await getServerSession(authOptions);
    if (!session || !session.user) {
      const secret = process.env.NEXTAUTH_SECRET || 'your-secret-key';
      const token = await getToken({ req: req as any, secret });
      if (!token || !(token as any).id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const userFromToken = await getUserById((token as any).id);
      if (!userFromToken) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      const { password: _p, ...safeUserFromToken } = userFromToken as any;
      try {
        const { readDatabase, getWalletBalance } = await import('@/db/dbService');
        const db = readDatabase();
        const jsonUser = db.users.find((u: any) => u.id === (token as any).id);
        (safeUserFromToken as any).enabled =
          typeof jsonUser?.enabled !== 'undefined' ? !!jsonUser.enabled : (safeUserFromToken as any).enabled ?? true;
        const walletBalance = await getWalletBalance((token as any).id);
        (safeUserFromToken as any).walletBalance = walletBalance;
        (safeUserFromToken as any).wallet_balance = walletBalance;
      } catch {
        (safeUserFromToken as any).enabled = (safeUserFromToken as any).enabled ?? true;
      }
      return NextResponse.json({ success: true, user: safeUserFromToken });
    }

    const user = await getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const { password, ...safeUser } = user as any;
    try {
      const { readDatabase, getWalletBalance } = await import('@/db/dbService');
      const db = readDatabase();
      const jsonUser = db.users.find((u: any) => u.id === session.user.id);
      (safeUser as any).enabled =
        typeof jsonUser?.enabled !== 'undefined' ? !!jsonUser.enabled : (safeUser as any).enabled ?? true;
      const walletBalance = await getWalletBalance(session.user.id);
      (safeUser as any).walletBalance = walletBalance;
      (safeUser as any).wallet_balance = walletBalance;
    } catch (profileError) {
      console.error('Error enriching profile:', profileError);
      (safeUser as any).enabled = (safeUser as any).enabled ?? true;
    }

    return NextResponse.json({ success: true, user: safeUser });
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
