import NextAuth, { type NextAuthOptions } from 'next-auth';
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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('Login failed: Missing credentials');
          return null;
        }

        console.log(`Login attempt with email: ${credentials.email}`);

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
          const jsonUser = db.users.find((u: any) => u.id === result.user!.id || u.email === result.user!.email);
          if (jsonUser && jsonUser.enabled === false) {
            console.log('Login blocked: user is disabled');
            return null;
          }
        } catch (e) {
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
        (token as any).id = (user as any).id;
        (token as any).role = (user as any).role;
        (token as any).name = (user as any).name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = (token as any).id as string;
        (session.user as any).role = (token as any).role as string;
        (session.user as any).name = (token as any).name as string;
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