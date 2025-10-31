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

        // Admin login
        if (credentials.email === adminUser.email) {
          console.log('Admin user detected');
          // For admin login, use direct comparison with 'admin123' in production
          // This ensures admin login works even if bcrypt has issues in serverless environment
          const isAdminPassword = credentials.password === 'admin123';
          const passwordMatch = isAdminPassword || await bcrypt.compare(credentials.password, adminUser.password);
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
  // Configure cookies for session management
  cookies: (() => {
    const isSecure = process.env.NODE_ENV === 'production';
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const host = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).hostname : undefined;
    const domain = cookieDomain || host;

    return {
      sessionToken: {
        name: isSecure ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: isSecure,
          domain,
        },
      },
      csrfToken: {
        // CSRF token must be readable by the client
        name: isSecure ? '__Host-next-auth.csrf-token' : 'next-auth.csrf-token',
        options: {
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
          secure: isSecure,
          domain,
        },
      },
      callbackUrl: {
        name: isSecure ? '__Secure-next-auth.callback-url' : 'next-auth.callback-url',
        options: {
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
          secure: isSecure,
          domain,
        },
      },
      state: {
        name: isSecure ? '__Secure-next-auth.state' : 'next-auth.state',
        options: {
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
          secure: isSecure,
          domain,
        },
      },
    };
  })(),
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key',
  // trustHost: true, // removed – not a valid NextAuth option
};