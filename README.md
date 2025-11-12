# Stock Analysis Platform

A comprehensive stock analysis platform built with Next.js 14, featuring user authentication, wallet management, strategy analysis, and admin dashboard.

## 🚀 Features

- **User Authentication**: Secure login/signup with NextAuth.js
- **Admin Dashboard**: Complete admin panel for user and transaction management
- **Wallet System**: Digital wallet with deposit/withdrawal functionality
- **Strategy Analysis**: AI-powered stock analysis strategies
- **Payment Integration**: Support for UPI, USDT (ERC20/TRC20), and bank transfers
- **Responsive Design**: Mobile-first responsive UI
- **Real-time Analytics**: Admin analytics and reporting

## 🛠 Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: MySQL with JSON fallback
- **Authentication**: NextAuth.js
- **Deployment**: Vercel
- **Styling**: Tailwind CSS, Custom CSS

## 📋 Prerequisites

- Node.js 18+ 
- MySQL database (local or cloud)
- Git

## 🔧 Local Development Setup

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd Client-demo
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create `.env.local` file in the root directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=stock-analysis-db
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=false

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key-here-make-it-long-and-random

# Optional: Cookie Domain (for production)
# COOKIE_DOMAIN=yourdomain.com
```

### 4. Database Setup
Run the database migration:
```bash
node scripts/migrate.js
```

### 5. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## 🌐 Production Deployment (Vercel)

### 1. Database Setup

#### Option A: Using Cloud MySQL Provider
Choose a managed MySQL service:
- **Railway**: Easy setup, good for small projects
- **PlanetScale**: Serverless MySQL, great scaling
- **AWS RDS**: Enterprise-grade, more configuration
- **DigitalOcean**: Simple managed MySQL
- **Google Cloud SQL**: Google's managed MySQL

#### Option B: Complete SQL Setup
Use the provided `database_setup.sql` file:

1. **Create Database and User**:
```sql
CREATE DATABASE IF NOT EXISTS stock-analysis-db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'app_user'@'%' IDENTIFIED BY 'your-strong-password';
GRANT ALL PRIVILEGES ON stock-analysis-db.* TO 'app_user'@'%';
FLUSH PRIVILEGES;
```

2. **Run Complete Setup**:
Execute the `database_setup.sql` file in your MySQL console or via command line:
```bash
mysql -h your-host -u app_user -p stock_analysis_db < database_setup.sql
```

This script creates:
- All required tables (`users`, `wallet_transactions`, `strategies`)
- Optional columns for JSON sync compatibility
- Admin user (email: `admin@example.com`, password: `admin123`)
- Test user and sample strategies

### 2. Vercel Environment Variables

In your Vercel project settings, add these environment variables:

```env
# Database Configuration
DB_HOST=your-mysql-host
DB_PORT=3306
DB_USER=app_user
DB_PASSWORD=your-strong-password
DB_NAME=stock_analysis_db
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false

# NextAuth Configuration
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your-super-secret-key-here-make-it-long-and-random

# Optional: Cookie Domain
COOKIE_DOMAIN=your-app.vercel.app
```

### 3. Deploy to Vercel

#### Via Vercel CLI:
```bash
npm install -g vercel
vercel --prod
```

#### Via GitHub Integration:
1. Connect your GitHub repository to Vercel
2. Push your changes to the main branch
3. Vercel will automatically deploy

### 4. Post-Deployment Verification

1. **Test Database Connection**:
   Visit: `https://your-app.vercel.app/api/test-db`
   Should return: `{"message":"Database connected","result":[...]}`

2. **Test Admin Login**:
   - Go to: `https://your-app.vercel.app/admin-login`
   - Email: `admin@example.com`
   - Password: `admin123`

3. **Test User Registration**:
   - Go to: `https://your-app.vercel.app/signup`
   - Create a new user account

## 📊 Data Migration

### Export JSON Users to MySQL
If you have existing users in `src/db/database.json`, use the sync endpoint:

1. **Login as Admin**
2. **Make POST Request**:
```bash
curl -X POST https://your-app.vercel.app/api/admin/sync \
  --cookie "your-session-cookie"
```

Or use the admin panel sync feature (if implemented in UI).

## 🔐 Default Credentials

### Admin Access
- **Email**: `admin@example.com`
- **Password**: `admin123`
- **Access**: Full admin dashboard, user management, analytics

### Test User (if seeded)
- **Email**: `test@example.com`
- **Password**: `userpass123`
- **Access**: Regular user features, wallet, strategies

## 🗂 Project Structure

```
├── src/
│   ├── app/                    # Next.js 14 App Router
│   │   ├── admin/             # Admin dashboard pages
│   │   ├── api/               # API routes
│   │   ├── login/             # Authentication pages
│   │   ├── payment/           # Payment flow
│   │   ├── strategies/        # Strategy pages
│   │   └── wallet/            # Wallet management
│   ├── components/            # Reusable components
│   │   ├── admin/            # Admin-specific components
│   │   └── ui/               # UI components
│   ├── db/                   # Database configuration
│   │   ├── database.json     # JSON fallback database
│   │   ├── dbService.ts      # Database service layer
│   │   └── (consolidated)    # Schema moved to root database_setup.sql
│   ├── lib/                  # Utility libraries
│   │   ├── auth-options.ts   # NextAuth configuration
│   │   └── utils.ts          # Helper utilities
│   └── styles/               # CSS styles
├── public/                   # Static assets
├── scripts/                  # Database migration scripts
└── database_setup.sql        # Complete database setup
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `GET/POST /api/auth/[...nextauth]` - NextAuth endpoints

### Admin APIs
- `GET /api/admin/users` - Get all users
- `GET /api/admin/transactions` - Get all transactions
- `POST /api/admin/sync` - Sync JSON to MySQL
- `GET /api/admin/analytics` - Get analytics data

### User APIs
- `GET /api/test-db` - Test database connection
- `POST /api/wallet/deposit` - Process wallet deposit
- `GET /api/strategies` - Get available strategies

## 🐛 Troubleshooting

### Common Issues

#### 1. Database Connection Errors
**Error**: `ECONNREFUSED` or `ER_ACCESS_DENIED_ERROR`
**Solution**:
- Verify database credentials in environment variables
- Check if database server is running
- Ensure user has proper permissions
- For cloud databases, check SSL settings

#### 2. Build Failures on Vercel
**Error**: `useSearchParams() should be wrapped in a Suspense boundary`
**Solution**: Already fixed in codebase. All pages using `useSearchParams` are wrapped in `Suspense` boundaries.

#### 3. Admin Login Not Working
**Error**: Cannot login with admin credentials
**Solution**:
- Ensure admin user is seeded in database
- Check if `NEXTAUTH_URL` matches your deployment URL
- Verify `NEXTAUTH_SECRET` is set

#### 4. Environment Variables Not Loading
**Error**: `process.env.VARIABLE_NAME` is undefined
**Solution**:
- In development: Use `.env.local`
- In production: Set in Vercel dashboard
- Restart development server after changes

#### 5. JSON Sync Errors
**Error**: SQL errors during `/api/admin/sync`
**Solution**:
- Ensure optional columns are added to users table:
```sql
ALTER TABLE users ADD COLUMN stock_analysis_access BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN analysis_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN trial_expiry DATETIME NULL;
```

### Database Schema Issues
If you encounter schema mismatches:

1. **Check Current Schema**:
```sql
DESCRIBE users;
DESCRIBE wallet_transactions;
DESCRIBE strategies;
```

2. **Add Missing Columns**:
Use the `database_setup.sql` file to ensure all columns exist.

3. **Reset Database** (if needed):
```sql
DROP DATABASE stock_analysis_db;
-- Then run database_setup.sql again
```

## 🔒 Security Considerations

### Production Checklist
- [ ] Use strong, unique `NEXTAUTH_SECRET`
- [ ] Enable SSL for database connections (`DB_SSL=true`)
- [ ] Use environment variables for all secrets
- [ ] Never commit `.env` files to repository
- [ ] Use hashed passwords (bcrypt with salt rounds ≥ 12)
- [ ] Implement rate limiting for API endpoints
- [ ] Validate and sanitize all user inputs
- [ ] Use HTTPS in production (`NEXTAUTH_URL` should use https://)

### Environment Variables Security
- Development: Use `.env.local` (gitignored)
- Production: Set in Vercel dashboard
- Never use `.env` in production builds

## 📈 Performance Optimization

### Database
- Use connection pooling for MySQL
- Index frequently queried columns
- Implement query caching where appropriate

### Frontend
- Images are optimized with Next.js Image component
- CSS is minified and tree-shaken
- JavaScript is code-split automatically

### Deployment
- Vercel provides automatic CDN and edge caching
- Static pages are pre-rendered where possible
- API routes are serverless functions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'Add feature-name'`
6. Push: `git push origin feature-name`
7. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter issues:

1. Check this README's troubleshooting section
2. Verify all environment variables are set correctly
3. Test database connection with `/api/test-db`
4. Check Vercel deployment logs
5. Review browser console for client-side errors

For additional support, please create an issue in the repository with:
- Error message
- Steps to reproduce
- Environment details (local/production)
- Browser/Node.js versions
