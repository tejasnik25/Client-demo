import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export const checkAdminAuth = async () => {
  const session = await getServerSession(authOptions);
  
  // Check if user is authenticated and has ADMIN role
  if (!session || !session.user || session.user.role !== 'ADMIN') {
    return null;
  }
  
  return session;
};