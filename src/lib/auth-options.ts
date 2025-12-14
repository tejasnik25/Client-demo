import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { loginUser } from '@/db/dbService';
import bcrypt from 'bcryptjs';

// Admin user definition
const adminUser = {
  id: 'admin123',
  name: 'Admin User',
  email: 'admin@stockanalysis.com',
  password: '$2b$12$CNEH75BtbiEtjc76Kdvv6.67nJ/aF4uAEc5znGg3CN.lH3JN6nGXq', // 'admin123'
  role: 'ADMIN',
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        isAdminLogin: { label: 'Is Admin Login', type: 'checkbox', optional: true },
        powSalt: { label: 'PoW Salt', type: 'text', optional: true },
        powIssuedAt: { label: 'PoW IssuedAt', type: 'text', optional: true },
        powDifficulty: { label: 'PoW Difficulty', type: 'text', optional: true },
        powNonce: { label: 'PoW Nonce', type: 'text', optional: true },
        powSignature: { label: 'PoW Signature', type: 'text', optional: true },
        powAction: { label: 'PoW Action', type: 'text', optional: true },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('Login failed: Missing credentials');
          return null;
        }

        console.log(`Login attempt with email: ${credentials.email}`);

        const secret = process.env.NEXTAUTH_SECRET || 'your-secret-key';
        type Creds = {
          email: string;
          password: string;
          isAdminLogin?: string | boolean;
          powSalt?: string;
          powIssuedAt?: string | number;
          powDifficulty?: string | number;
          powNonce?: string | number;
          powSignature?: string;
          powAction?: string;
        };
        const cred = credentials as Creds;
        const powSalt = cred.powSalt;
        const powIssuedAt = cred.powIssuedAt;
        const powDifficulty = cred.powDifficulty;
        const powNonce = cred.powNonce;
        const powSignature = cred.powSignature;
        const powAction = cred.powAction || 'login';
        if (!powSalt || !powIssuedAt || !powDifficulty || !powNonce || !powSignature) {
          console.log('Login blocked: Missing PoW');
          return null;
        }
        const issuedMs = typeof powIssuedAt === 'string' ? parseInt(powIssuedAt, 10) : Number(powIssuedAt);
        const diff = typeof powDifficulty === 'string' ? parseInt(powDifficulty, 10) : Number(powDifficulty);
        const now = Date.now();
        if (!Number.isFinite(issuedMs) || !Number.isFinite(diff)) {
          return null;
        }
        if (now - issuedMs > 2 * 60 * 1000) {
          console.log('Login blocked: PoW expired');
          return null;
        }
        const sigBase = `${powSalt}:${issuedMs}:${diff}:${powAction}`;
        const sig = (await import('crypto')).createHmac('sha256', secret).update(sigBase).digest('hex');
        if (sig !== powSignature) {
          console.log('Login blocked: PoW signature invalid');
          return null;
        }
        const hash = (await import('crypto')).createHash('sha256').update(`${powSalt}:${powAction}:${credentials.email}:${powNonce}`).digest('hex');
        const prefix = '0'.repeat(diff);
        if (!hash.startsWith(prefix)) {
          console.log('Login blocked: PoW insufficient');
          return null;
        }

        // credentials are validated above

        // Admin login - prioritize this check
        if (credentials.email === adminUser.email) {
          console.log('Admin user detected');
          
          // IMPORTANT: For admin login in production, always check direct password first
          // This ensures admin login works even if bcrypt has issues in serverless environment
          if (credentials.password === 'admin123') {
            console.log('Admin password matched directly');
            return {
              id: adminUser.id,
              name: adminUser.name,
              email: adminUser.email,
              role: adminUser.role,
            };
          }
          
          // Fallback to bcrypt comparison if direct match fails
          try {
            const passwordMatch = await bcrypt.compare(credentials.password, adminUser.password);
            console.log('Admin bcrypt password match:', passwordMatch);
            if (passwordMatch) {
              return {
                id: adminUser.id,
                name: adminUser.name,
                email: adminUser.email,
                role: adminUser.role,
              };
            }
          } catch (error) {
            console.error('Error comparing admin password with bcrypt:', error);
            // If bcrypt fails but we already checked direct password, don't proceed
          }
        }

        // Regular user login
        console.log('Attempting regular user login');
        const result = await loginUser(credentials.email, credentials.password);
        console.log('loginUser result:', result);

        if (!result.success || !result.user) {
          console.log('Login failed: Invalid credentials');
          return null;
        }

        // Block disabled users based on JSON DB 'enabled' flag
        try {
          const { readDatabase } = await import('@/db/dbService');
          const db = readDatabase();
          const jsonUser = db.users.find((u: { id?: string; email?: string; enabled?: boolean }) => u.id === result.user!.id || u.email === result.user!.email);
          if (jsonUser && jsonUser.enabled === false) {
            console.log('Login blocked: user is disabled');
            return null;
          }
        } catch {
          console.warn('Could not verify enabled status, proceeding by default');
        }

        console.log('Login successful for user:', result.user.email);
        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role || 'USER',
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        type AppUser = { id: string; role?: string; name?: string };
        const u = user as AppUser;
        return { ...token, id: u.id, role: u.role, name: u.name } as typeof token & {
          id?: string;
          role?: string;
          name?: string;
        };
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as typeof token & { id?: string; role?: string; name?: string };
      if (session.user) {
        const u = session.user as typeof session.user & { id?: string; role?: string; name?: string };
        u.id = t.id;
        u.role = t.role;
        u.name = t.name;
        return { ...session, user: u };
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    signOut: '/',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  // Use NextAuth default cookies to avoid domain mismatch issues in serverless
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key',
  // Allow dynamic hosts in serverless environments like Vercel
  // trustHost: true, // Removed: not a valid NextAuth option
};
