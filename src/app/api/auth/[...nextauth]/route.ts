import NextAuth, { NextAuthOptions, DefaultSession, DefaultUser } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { loginUser } from '@/db/dbService';

// Import bcrypt for password hashing
import bcrypt from 'bcryptjs';

// Add an admin user to the initial database
const adminUser = {
  id: "admin123",
  name: "Admin User",
  email: "admin@example.com",
  password: "$2b$12$CNEH75BtbiEtjc76Kdvv6.67nJ/aF4uAEc5znGg3CN.lH3JN6nGXq", // Hashed version of 'admin123'
  role: "ADMIN" // Use uppercase to match dbService.ts enum
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        isAdminLogin: { label: 'Is Admin Login', type: 'checkbox', optional: true }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('Login failed: Missing credentials');
          return null;
        }

        console.log(`Login attempt with email: ${credentials.email}`);

        // Check if it's the admin user
        if (credentials.email === adminUser.email) {
          console.log('Admin user detected');
          const passwordMatch = await bcrypt.compare(credentials.password, adminUser.password);
          console.log('Admin password match:', passwordMatch);
          if (passwordMatch) {
            return {
              id: adminUser.id,
              name: adminUser.name,
              email: adminUser.email,
              role: adminUser.role
            };
          }
        }

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
          role: result.user.role || 'USER', // Default to USER role (uppercase to match dbService.ts enum)
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  pages: {
    // Keep the default signIn page as user login
    signIn: '/login',
    signOut: '/',
    error: '/login',
    // Admin login page will handle its own redirects
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key', // Provide a default secret for development
  // trustHost helps when running behind proxies or non-standard dev setups
  trustHost: true,
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      walletBalance?: number;
      stockAnalysisAccess?: boolean;
      analysisCount?: number;
    };
  }
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };