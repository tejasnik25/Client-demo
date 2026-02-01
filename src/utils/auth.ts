/**
 * Utility functions for authentication
 */

/**
 * Generate a random OTP (One-Time Password)
 * @returns A 6-digit OTP
 */
export function generateOTP(): string {
  // Generate a random 6-digit number
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Validate an email address format
 * @param email The email address to validate
 * @returns True if the email is valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param password The password to validate
 * @returns True if the password meets requirements, false otherwise
 */
export function validatePassword(password: string): boolean {
  // Password must be at least 8 characters
  return password.length >= 8;
}