import NextAuth, { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { loginUser } from '@/db/dbService';
import bcrypt from 'bcryptjs';

// Admin user definition
const adminUser = {
  id: 'admin123',
  name: 'Admin User',
  email: 'admin@example.com',
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

        // Admin login
        if (credentials.email === adminUser.email) {
          console.log('Admin user detected');
          const passwordMatch = await bcrypt.compare(credentials.password, adminUser.password);
          console.log('Admin password match:', passwordMatch);
          if (passwordMatch) {
            return {
              id: adminUser.id,
              name: adminUser.name,
              email: adminUser.email,
              role: adminUser.role,
            };
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
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key',
  trustHost: true,
};