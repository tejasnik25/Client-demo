# Admin Authentication System

This document explains how the admin authentication system works in the Stock Analysis App.

## Admin Login Page

The application has a dedicated admin login page at `/admin-login` that is separate from the regular user login page. This page is specifically designed for administrators and has a distinct look and feel.

### Key Features
- Dedicated admin login portal with security warning
- Admin-specific form validation (password length check)
- Clear redirection to the admin dashboard upon successful login
- Link to the regular user login page for convenience

## Authentication Flow

1. **Accessing the Admin Portal**
   - Administrators can access the admin login page directly at `/admin-login`
   - A link to the admin login page is available on the regular user login page

2. **Login Process**
   - The admin enters their credentials (email and password)
   - The system validates the credentials and checks the user's role
   - If the user is an admin, they are redirected to the admin dashboard
   - If the credentials are invalid or the user is not an admin, an appropriate error message is displayed

3. **Security Measures**
   - The admin login page displays a security warning
   - Only users with the `ADMIN` role can access the admin dashboard
   - Unauthenticated users are redirected to the admin login page
   - Non-admin authenticated users are redirected to the user dashboard

## Test Credentials

For development and testing purposes, the following admin credentials are available:
- Email: `admin@example.com`
- Password: `admin123`

## Implementation Details

### NextAuth Configuration

The NextAuth configuration has been modified to handle admin authentication specifically. Key components include:

1. **Admin User Definition**
   - An admin user is defined directly in the NextAuth configuration
   - The password is securely hashed using bcrypt
   - The user role is set to `ADMIN` (uppercase)

2. **Credentials Provider**
   - The credentials provider checks if the user is the admin before attempting regular user authentication
   - Password comparison is done using bcrypt
   - Upon successful authentication, the user's role is included in the session

### Admin Dashboard Authentication

Both the admin page (`/admin/page.tsx`) and admin layout (`/admin/layout.tsx`) implement authentication checks to ensure only administrators can access the dashboard.

## Files Modified

- `src/app/admin-login/page.tsx` - Enhanced admin login page with validation and security warnings
- `src/app/admin-login/layout.tsx` - Fixed missing Metadata import
- `src/app/login/page.tsx` - Added admin login link and test credentials
- `src/app/api/auth/[...nextauth]/route.ts` - Fixed bcrypt import and improved admin authentication logic
- `docs/ADMIN_AUTH.md` - Created documentation for the admin authentication system
- `test-admin-login-flow.js` - Created test script to verify the admin login flow

## Testing the System

To test the admin authentication system, follow the steps outlined in `test-admin-login-flow.js`.

1. Access the regular login page and click on the "Admin Login" link
2. Enter the admin credentials
3. Verify that you are redirected to the admin dashboard
4. Test security by trying to access the admin dashboard without logging in or with regular user credentials