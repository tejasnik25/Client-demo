import bcrypt from 'bcryptjs';

/**
 * Hashes a password using bcryptjs
 * @param password - The password to hash
 * @returns The hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Validates an email address format
 * @param email - The email address to validate
 * @returns Boolean indicating if the email format is valid
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
  return emailRegex.test(email);
}