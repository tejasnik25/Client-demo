// Define types
import bcrypt from 'bcryptjs';
import { hashPassword } from '@/lib/auth';
import pool from './db'; // Import centralized database connection
// NOTE: Avoid importing Node modules at top-level to keep this file safe
// when bundled into client components. We'll resolve fs/path inside
// server-only functions at runtime.

// Read database from JSON file
export const readDatabase = () => {
  // Prevent client-side usage; this is server-only.
  if (typeof window !== 'undefined') {
    console.warn('readDatabase() is server-only and should not run in the browser.');
    return { users: [], wallet_transactions: [], strategies: [] };
  }
  try {
    const path = require('path');
    const fs = require('fs');
    const DB_FILE_PATH = path.join(process.cwd(), 'src', 'db', 'database.json');
    
    // Check if running on Vercel (handles both '1' and true values)
    if (process.env.VERCEL) {
      console.log('Running on Vercel, using in-memory database');
      return { 
        users: [
          // Include admin user in default database to ensure admin access works
          {
            id: 'admin123',
            name: 'Admin User',
            email: 'admin@stockanalysis.com',
            password: '$2b$12$CNEH75BtbiEtjc76Kdvv6.67nJ/aF4uAEc5znGg3CN.lH3JN6nGXq', // 'admin123'
            role: 'ADMIN',
            wallet_balance: 0,
            email_verified: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            enabled: true
          }
        ], 
        wallet_transactions: [], 
        strategies: [] 
      };
    }
    
    // Check if file exists first (important for Vercel production)
    if (!fs.existsSync(DB_FILE_PATH)) {
      console.warn('Database file not found, using default empty database');
      return { 
        users: [
          // Include admin user in default database to ensure admin access works
          {
            id: 'admin123',
            name: 'Admin User',
            email: 'admin@stockanalysis.com',
            password: '$2b$12$CNEH75BtbiEtjc76Kdvv6.67nJ/aF4uAEc5znGg3CN.lH3JN6nGXq', // 'admin123'
            role: 'ADMIN',
            wallet_balance: 0,
            email_verified: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            enabled: true
          }
        ], 
        wallet_transactions: [], 
        strategies: [] 
      };
    }
    
    const data = fs.readFileSync(DB_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file:', error);
    // Return default structure if file doesn't exist or is invalid
    return { 
      users: [
        // Include admin user in fallback database
        {
          id: 'admin123',
          name: 'Admin User',
          email: 'admin@stockanalysis.com',
          password: '$2b$12$CNEH75BtbiEtjc76Kdvv6.67nJ/aF4uAEc5znGg3CN.lH3JN6nGXq', // 'admin123'
          role: 'ADMIN',
          wallet_balance: 0,
          email_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          enabled: true
        }
      ], 
      wallet_transactions: [], 
      strategies: [] 
    };
  }
};

// Write database to JSON file
export const writeDatabase = (data: any) => {
  // Prevent client-side usage; this is server-only.
  if (typeof window !== 'undefined') {
    console.warn('writeDatabase() is server-only and should not run in the browser.');
    return false;
  }
  
  // Check if we're in Vercel production environment
  // VERCEL is set in Vercel environment (could be '1' or true)
  const isVercelProduction = !!process.env.VERCEL;
  
  // In Vercel production, don't attempt to write to filesystem
  if (isVercelProduction) {
    console.log('Running in Vercel production environment, skipping file write');
    return true; // Return true to prevent errors in calling code
  }
  
  // Also check for read-only file system error (common in serverless environments)
  try {
    const path = require('path');
    const fs = require('fs');
    const DB_FILE_PATH = path.join(process.cwd(), 'src', 'db', 'database.json');
    
    // Try to write to the file
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    // If we get EROFS (read-only file system) error, log and return success
    if ((error as any).code === 'EROFS') {
      console.log('Read-only file system detected, skipping file write');
      return true; // Return true to prevent errors in calling code
    }
    
    console.error('Error writing to database file:', error);
    return false;
  }
};

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  wallet_balance: number;
  role: 'USER' | 'ADMIN';
  email_verified: boolean;
  created_at: string;
  updated_at: string;
};



type WalletTransaction = {
  id: string;
  user_id: string;
  amount: number;
  capital?: number;
  transaction_type: 'deposit' | 'charge';
  payment_method?: string;
  transaction_id?: string;
  receipt_path?: string;
  platform?: 'MT4' | 'MT5';
  mt_account_id?: string;
  mt_account_password?: string; // Stored as plain text per requirement
  mt_account_server?: string;
  terms_accepted?: boolean;
  strategy_id?: string;
  plan_level?: 'Premium' | 'Expert' | 'Pro';
  // New optional fields
  inr_amount?: number;
  inr_to_usd_rate?: number;
  crypto_network?: 'ERC20' | 'TRC20';
  crypto_wallet_address?: string;
  wallet_app_deeplink?: string;
  admin_message?: string;
  admin_message_status?: 'pending' | 'sent' | 'resolved';
  status: 'pending' | 'in-process' | 'completed' | 'failed';
  admin_id?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at?: string;
};

export type Strategy = {
  id: string;
  name: string;
  description: string;
  // Deprecated display fields (retained for backward compatibility)
  performance: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  category: 'Growth' | 'Income' | 'Momentum' | 'Value';
  // Display image/icon
  imageUrl: string;
  // New metrics
  minCapital?: number;
  avgDrawdown?: number;
  riskReward?: number;
  winStreak?: number;
  // Tag
  tag?: string;
  // Plan prices by level
  planPrices?: { Pro?: number; Expert?: number; Premium?: number };
  // Optional user-facing plan details (labels/percents)
  planDetails?: {
    Pro?: { priceLabel?: string; percent?: number };
    Expert?: { priceLabel?: string; percent?: number };
    Premium?: { priceLabel?: string; percent?: number };
  };
  // Details and content
  details: string;
  parameters: Record<string, string>;
  contentType?: string;
  contentUrl?: string;
  // Server-side only: binary content storage
  contentBlob?: Buffer;
  contentMime?: string;
  enabled?: boolean;
  created_at: string;
  updated_at: string;
};

// Initialize database with MySQL connection
const initializeDatabase = async () => {
  try {
    // Create tables if they don't exist
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        wallet_balance DECIMAL(10,2) DEFAULT 0,
        role ENUM('USER', 'ADMIN') DEFAULT 'USER',
        email_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        amount DECIMAL(10,2) NOT NULL,
        transaction_type ENUM('deposit', 'charge'),
        payment_method VARCHAR(100),
        transaction_id VARCHAR(255),
        receipt_path VARCHAR(500),
        platform ENUM('MT4', 'MT5'),
        mt_account_id VARCHAR(255),
        mt_account_password VARCHAR(255),
        terms_accepted BOOLEAN DEFAULT FALSE,
        strategy_id VARCHAR(255),
        plan_level ENUM('Premium','Expert','Pro'),
        admin_message TEXT,
        admin_message_status ENUM('pending','sent','resolved') DEFAULT 'pending',
        status ENUM('pending', 'in-process', 'completed', 'failed') DEFAULT 'pending',
        admin_id VARCHAR(255),
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Analysis history table (used in getUserById)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS analysis_history (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        symbol VARCHAR(64),
        analysis TEXT,
        score DECIMAL(6,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_analysis_user (user_id, created_at)
      )
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS strategies (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        performance INT DEFAULT 0,
        risk_level ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
        category ENUM('Growth', 'Income', 'Momentum', 'Value') DEFAULT 'Growth',
        image_url VARCHAR(500),
        details TEXT,
        parameters JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Minimal auto-migrations to align legacy DBs
    try { await pool.execute("ALTER TABLE users ADD COLUMN role ENUM('USER','ADMIN') DEFAULT 'USER'"); } catch (e) {}
    try { await pool.execute("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN platform ENUM('MT4', 'MT5')"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN mt_account_id VARCHAR(255)"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN mt_account_password VARCHAR(255)"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN terms_accepted BOOLEAN DEFAULT FALSE"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN strategy_id VARCHAR(255)"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN plan_level ENUM('Premium','Expert','Pro')"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN admin_id VARCHAR(255)"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"); } catch (e) {}
    // Add INR/USDT columns for new payment flows
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN inr_amount DECIMAL(12,2)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN inr_to_usd_rate DECIMAL(12,6)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN crypto_network ENUM('ERC20','TRC20')"); } catch (e) {}
  try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN crypto_wallet_address VARCHAR(128)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN mt_account_server VARCHAR(255)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN capital DECIMAL(12,2)"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN wallet_app_deeplink VARCHAR(255)"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN rejection_reason TEXT"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions MODIFY COLUMN status ENUM('pending','in-process','completed','failed') DEFAULT 'pending'"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN admin_message TEXT"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN admin_message_status ENUM('pending','sent','resolved') DEFAULT 'pending'"); } catch (e) {}
  // Ensure running_strategies exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS running_strategies (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        strategy_id VARCHAR(255) NOT NULL,
        plan ENUM('Pro','Expert','Premium'),
        capital DECIMAL(14,2),
        status ENUM('in-process','active','stopped') DEFAULT 'in-process',
        admin_status ENUM('in-process','wrong-account-password','wrong-account-id','wrong-account-server-name','running') DEFAULT 'in-process',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE,
        UNIQUE KEY uniq_user_strategy (user_id, strategy_id)
      )
    `);
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS running_strategy_modifications (
        id VARCHAR(255) PRIMARY KEY,
        running_strategy_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        platform ENUM('MT4','MT5'),
        mt_account_id VARCHAR(255),
        mt_account_password VARCHAR(255),
        mt_account_server VARCHAR(255),
        status ENUM('in-process','wrong-account-password','wrong-account-id','wrong-account-server-name','running') DEFAULT 'in-process',
        new_update_json JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (running_strategy_id) REFERENCES running_strategies(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  try { await pool.execute("ALTER TABLE running_strategies ADD COLUMN admin_status ENUM('in-process','wrong-account-password','wrong-account-id','wrong-account-server-name','running') DEFAULT 'in-process'"); } catch (e) {}
  // Add strategy columns if missing
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN content_type VARCHAR(16)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN content_url VARCHAR(500)"); } catch (e) {}
  // Widen content_url to TEXT to support longer URLs (e.g., data URLs)
  try { await pool.execute("ALTER TABLE strategies MODIFY content_url TEXT"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN enabled BOOLEAN DEFAULT TRUE"); } catch (e) {}
  // New fields
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN min_capital DECIMAL(14,2)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN avg_drawdown DECIMAL(8,2)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN risk_reward DECIMAL(8,2)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN win_streak INT"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN tag VARCHAR(255)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN plan_prices JSON"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN plan_details JSON"); } catch (e) {}
  // Binary content storage for Vercel-safe uploads
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN content_blob LONGBLOB"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN content_mime VARCHAR(255)"); } catch (e) {}
    // Ensure analysis_history has expected columns (minimal auto-migrations)
    try { await pool.execute("ALTER TABLE analysis_history ADD COLUMN symbol VARCHAR(64)"); } catch (e) {}
    try { await pool.execute("ALTER TABLE analysis_history ADD COLUMN analysis TEXT"); } catch (e) {}
    try { await pool.execute("ALTER TABLE analysis_history ADD COLUMN score DECIMAL(6,2)"); } catch (e) {}
    try { await pool.execute("ALTER TABLE analysis_history ADD INDEX idx_analysis_user (user_id, created_at)"); } catch (e) {}

    console.log('Database tables initialized successfully');
    
    // Initialize default data
    await initializeDefaultData();
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

// Initialize default data
const initializeDefaultData = async () => {
  try {
    // Check if admin user exists
    const [adminRows] = await pool.execute('SELECT id FROM users WHERE email = ?', ['admin@stockanalysis.com']);
    
    if ((adminRows as any[]).length === 0) {
      const hashedPassword = await hashPassword('admin123');
      await pool.execute(
        `INSERT INTO users (id, name, email, password, role, email_verified, wallet_balance) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['admin123', 'Admin User', 'admin@stockanalysis.com', hashedPassword, 'ADMIN', true, 0]
      );
    }

    // Check if test user exists
    const [userRows] = await pool.execute('SELECT id FROM users WHERE id = ? OR email = ?', ['user123', 'user@example.com']);
    
    if ((userRows as any[]).length === 0) {
      const hashedPassword = await hashPassword('userpass123');
      await pool.execute(
        `INSERT INTO users (id, name, email, password, role, email_verified, wallet_balance) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['user123', 'John Doe', 'user@example.com', hashedPassword, 'USER', true, 100]
      );
    }

    // Add test user for login
    const [testUserRows] = await pool.execute('SELECT id FROM users WHERE email = ?', ['test@example.com']);
    
    if ((testUserRows as any[]).length === 0) {
      const hashedPassword = await hashPassword('password123');
      await pool.execute(
        `INSERT INTO users (id, name, email, password, role, email_verified, wallet_balance) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['test123', 'Test User', 'test@example.com', hashedPassword, 'USER', true, 50]
      );
    }
    
    // Analysis pricing removed

    // Initialize default strategies
    await addDefaultStrategies();
    
    console.log('Default data initialized successfully');
  } catch (error) {
    console.error('Error initializing default data:', error);
  }
};

// Add default strategies
const addDefaultStrategies = async () => {
  const defaultStrategies = [
    {
      id: '1',
      name: 'Growth Accelerator',
      description: 'Focuses on high-growth stocks with strong earnings potential.',
      performance: 16.5,
      riskLevel: 'Medium',
      category: 'Growth',
      imageUrl: '/strategy1.svg',
      details: 'This strategy uses machine learning algorithms to analyze historical data and identify stocks with the highest potential for growth.',
      parameters: {
        'Time Horizon': 'Long-term',
        'Sector Focus': 'Technology, Healthcare',
        'Rebalancing': 'Quarterly',
        'Position Size': '5-10 stocks'
      }
    },
    {
      id: '2',
      name: 'Dividend Aristocrat',
      description: 'Focuses on established companies with consistent dividend growth over 25+ years.',
      performance: 12.3,
      riskLevel: 'Low',
      category: 'Income',
      imageUrl: '/strategy2.svg',
      details: 'This income-focused strategy invests in companies that have increased their dividends for at least 25 consecutive years.',
      parameters: {
        'Dividend Yield': '2-4%',
        'Payout Ratio': '<60%',
        'Market Cap': 'Large-cap',
        'Sector Focus': 'Consumer Staples, Utilities, Healthcare'
      }
    },
    {
      id: '3',
      name: 'Momentum Trader',
      description: 'Capitalizes on recent price trends and market momentum for short-term gains.',
      performance: 18.7,
      riskLevel: 'High',
      category: 'Momentum',
      imageUrl: '/strategy3.svg',
      details: 'This aggressive strategy identifies stocks with strong recent price performance and high trading volumes.',
      parameters: {
        'Time Horizon': 'Short-term',
        'Lookback Period': '3-6 months',
        'Volume Threshold': 'Above average',
        'Rebalancing': 'Weekly'
      }
    },
    {
      id: '4',
      name: 'Value Investor',
      description: 'Finds undervalued stocks with solid fundamentals trading below their intrinsic value.',
      performance: 15.2,
      riskLevel: 'Medium',
      category: 'Value',
      imageUrl: '/strategy4.svg',
      details: 'This strategy follows the principles of value investing, seeking companies trading at a discount to their intrinsic value.',
      parameters: {
        'P/E Ratio': '<Industry Average',
        'P/B Ratio': '<1.5',
        'Debt-to-Equity': '<0.5',
        'ROE': '>15%'
      }
    }
  ];

  for (const strategy of defaultStrategies) {
    const [existing] = await pool.execute('SELECT id FROM strategies WHERE id = ?', [strategy.id]);
    
    if ((existing as any[]).length === 0) {
      await pool.execute(
        `INSERT INTO strategies (id, name, description, performance, risk_level, category, image_url, details, parameters) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          strategy.id,
          strategy.name,
          strategy.description,
          strategy.performance,
          strategy.riskLevel,
          strategy.category,
          strategy.imageUrl,
          strategy.details,
          JSON.stringify(strategy.parameters)
        ]
      );
    }
  }
};

// Initialize database on startup
// We need to initialize the database in both development and production
// But avoid running during build time on Vercel
const isBuildTime = process.env.VERCEL_ENV === 'production' && process.env.VERCEL_REGION === undefined;
if (!isBuildTime) {
  // Initialize database for both development and production runtime
  initializeDatabase().catch(err => console.error('Database initialization failed:', err));
}

// Strategy CRUD operations
export const getAllStrategies = async (): Promise<Strategy[]> => {
  try {
    const [rows] = await pool.execute('SELECT * FROM strategies ORDER BY created_at DESC');
    // If MySQL returns zero rows, fall back to JSON
    if (!Array.isArray(rows) || rows.length === 0) {
      console.warn('MySQL strategies table is empty, falling back to JSON');
      const db: any = readDatabase();
      const strategies: any[] = Array.isArray(db.strategies) ? db.strategies : [];
      return strategies.map((s: any) => ({
        ...s,
        riskLevel: s.riskLevel ?? s.risk_level ?? 'medium',
        imageUrl: s.imageUrl ?? s.image_url ?? undefined,
        minCapital: s.minCapital ?? s.min_capital,
        avgDrawdown: s.avgDrawdown ?? s.avg_drawdown,
        riskReward: s.riskReward ?? s.risk_reward,
        winStreak: s.winStreak ?? s.win_streak,
        tag: s.tag,
        planPrices: s.planPrices ?? s.plan_prices,
        planDetails: s.planDetails ?? s.plan_details,
        parameters: typeof s.parameters === 'string' ? JSON.parse(s.parameters || '{}') : (s.parameters || {}),
        contentType: s.contentType ?? s.content_type,
        contentUrl: s.contentUrl ?? s.content_url,
        enabled: s.enabled !== false,
      }));
    }
    return (rows as any[]).map(row => ({
      ...row,
      riskLevel: row.risk_level,
      imageUrl: row.image_url,
      minCapital: row.min_capital !== undefined ? Number(row.min_capital) : undefined,
      avgDrawdown: row.avg_drawdown !== undefined ? Number(row.avg_drawdown) : undefined,
      riskReward: row.risk_reward !== undefined ? Number(row.risk_reward) : undefined,
      winStreak: row.win_streak !== undefined ? Number(row.win_streak) : undefined,
      tag: row.tag,
      planPrices: typeof row.plan_prices === 'string' ? JSON.parse(row.plan_prices) : row.plan_prices,
      planDetails: typeof row.plan_details === 'string' ? JSON.parse(row.plan_details) : row.plan_details,
      parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters || '{}') : (row.parameters || {}),
      contentType: row.content_type,
      contentUrl: row.content_url,
      enabled: row.enabled !== undefined ? !!row.enabled : true,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString()
    }));
  } catch (error) {
    console.error('Error getting strategies:', error);
    // JSON fallback for local environments
    try {
      const db: any = readDatabase();
      const strategies: any[] = Array.isArray(db.strategies) ? db.strategies : [];
      return strategies.map((s: any) => ({
        ...s,
        riskLevel: s.riskLevel ?? s.risk_level ?? 'medium',
        imageUrl: s.imageUrl ?? s.image_url ?? undefined,
        minCapital: s.minCapital ?? s.min_capital,
        avgDrawdown: s.avgDrawdown ?? s.avg_drawdown,
        riskReward: s.riskReward ?? s.risk_reward,
        winStreak: s.winStreak ?? s.win_streak,
        tag: s.tag,
        planPrices: s.planPrices ?? s.plan_prices,
        planDetails: s.planDetails ?? s.plan_details,
        parameters: typeof s.parameters === 'string' ? JSON.parse(s.parameters || '{}') : (s.parameters || {}),
        contentType: s.contentType ?? s.content_type,
        contentUrl: s.contentUrl ?? s.content_url,
        enabled: s.enabled !== false,
      }));
    } catch (jsonError) {
      console.error('JSON fallback getAllStrategies failed:', jsonError);
      return [];
    }
  }
};

export const getStrategyById = async (id: string): Promise<Strategy | null> => {
  try {
    const [rows] = await pool.execute('SELECT * FROM strategies WHERE id = ?', [id]);
    const strategies = rows as any[];
    
    if (strategies.length === 0) return null;
    
    const strategy = strategies[0];
    return {
      ...strategy,
      riskLevel: strategy.risk_level,
      imageUrl: strategy.image_url,
      minCapital: strategy.min_capital !== undefined ? Number(strategy.min_capital) : undefined,
      avgDrawdown: strategy.avg_drawdown !== undefined ? Number(strategy.avg_drawdown) : undefined,
      riskReward: strategy.risk_reward !== undefined ? Number(strategy.risk_reward) : undefined,
      winStreak: strategy.win_streak !== undefined ? Number(strategy.win_streak) : undefined,
      tag: strategy.tag,
      planPrices: typeof strategy.plan_prices === 'string' ? JSON.parse(strategy.plan_prices) : strategy.plan_prices,
      planDetails: typeof strategy.plan_details === 'string' ? JSON.parse(strategy.plan_details) : strategy.plan_details,
      parameters: typeof strategy.parameters === 'string' ? JSON.parse(strategy.parameters || '{}') : (strategy.parameters || {}),
      contentType: strategy.content_type,
      contentUrl: strategy.content_url,
      contentBlob: strategy.content_blob,
      contentMime: strategy.content_mime,
      enabled: strategy.enabled !== undefined ? !!strategy.enabled : true,
      created_at: strategy.created_at.toISOString(),
      updated_at: strategy.updated_at.toISOString()
    };
  } catch (error) {
    console.error('Error getting strategy by ID:', error);
    return null;
  }
};

export const createStrategy = async (
  strategy: Omit<Strategy, 'id' | 'created_at' | 'updated_at'> & { contentType?: string, contentUrl?: string, contentBlob?: Buffer, contentMime?: string, enabled?: boolean }
): Promise<{ success: boolean; strategy?: Strategy; error?: string }> => {
  try {
    const id = `strategy_${Date.now()}`;
    await pool.execute(
      `INSERT INTO strategies (id, name, description, performance, risk_level, category, image_url, min_capital, avg_drawdown, risk_reward, win_streak, tag, plan_prices, plan_details, details, parameters, content_type, content_url, content_blob, content_mime, enabled) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        strategy.name,
        strategy.description,
        strategy.performance,
        strategy.riskLevel,
        strategy.category,
        strategy.imageUrl,
        strategy.minCapital ?? null,
        strategy.avgDrawdown ?? null,
        strategy.riskReward ?? null,
        strategy.winStreak ?? null,
        strategy.tag ?? null,
        strategy.planPrices ? JSON.stringify(strategy.planPrices) : null,
        strategy.planDetails ? JSON.stringify(strategy.planDetails) : null,
        strategy.details,
        JSON.stringify(strategy.parameters || {}),
        strategy.contentType || null,
        strategy.contentUrl || null,
        strategy.contentBlob || null,
        strategy.contentMime || null,
        strategy.enabled !== false
      ]
    );
    const created = await getStrategyById(id);
    if (!created) return { success: false, error: 'Failed to read created strategy' };
    return { success: true, strategy: created };
  } catch (error) {
    console.error('MySQL createStrategy failed, falling back to JSON:', error);
    try {
      const db: any = readDatabase();
      const arr: any[] = Array.isArray(db.strategies) ? db.strategies : [];
      const now = new Date().toISOString();
      const strategyObj: Strategy = {
        id: `strategy_${Date.now()}`,
        name: strategy.name,
        description: strategy.description,
        performance: strategy.performance ?? 0,
        riskLevel: strategy.riskLevel ?? 'Medium',
        category: strategy.category ?? 'Growth',
        imageUrl: strategy.imageUrl ?? '/default-strategy.svg',
        minCapital: strategy.minCapital,
        avgDrawdown: strategy.avgDrawdown,
        riskReward: strategy.riskReward,
        winStreak: strategy.winStreak,
        tag: strategy.tag,
        planPrices: strategy.planPrices,
        planDetails: strategy.planDetails,
        details: strategy.details ?? '',
      parameters: strategy.parameters || {},
      contentType: strategy.contentType,
      contentUrl: strategy.contentUrl,
      contentBlob: strategy.contentBlob,
      contentMime: strategy.contentMime,
      enabled: strategy.enabled !== false,
      created_at: now,
      updated_at: now
      };
      db.strategies = [strategyObj, ...arr];
      writeDatabase(db);
      return { success: true, strategy: strategyObj };
    } catch (jsonError) {
      console.error('JSON fallback createStrategy failed:', jsonError);
      return { success: false, error: 'Failed to create strategy locally' };
    }
  }
};

export const updateStrategy = async (
  id: string,
  updates: Partial<Strategy>
): Promise<{ success: boolean; strategy?: Strategy; error?: string }> => {
  try {
    const setClause: string[] = [];
    const values: any[] = [];

    if (updates.name) { setClause.push('name = ?'); values.push(updates.name); }
    if (updates.description) { setClause.push('description = ?'); values.push(updates.description); }
    if (updates.performance !== undefined) { setClause.push('performance = ?'); values.push(updates.performance); }
    if (updates.riskLevel) { setClause.push('risk_level = ?'); values.push(updates.riskLevel); }
    if (updates.category) { setClause.push('category = ?'); values.push(updates.category); }
    if (updates.imageUrl) { setClause.push('image_url = ?'); values.push(updates.imageUrl); }
    if (updates.minCapital !== undefined) { setClause.push('min_capital = ?'); values.push(updates.minCapital); }
    if (updates.avgDrawdown !== undefined) { setClause.push('avg_drawdown = ?'); values.push(updates.avgDrawdown); }
    if (updates.riskReward !== undefined) { setClause.push('risk_reward = ?'); values.push(updates.riskReward); }
    if (updates.winStreak !== undefined) { setClause.push('win_streak = ?'); values.push(updates.winStreak); }
    if (updates.tag !== undefined) { setClause.push('tag = ?'); values.push(updates.tag); }
    if (updates.planPrices !== undefined) { setClause.push('plan_prices = ?'); values.push(JSON.stringify(updates.planPrices)); }
    if (updates.planDetails !== undefined) { setClause.push('plan_details = ?'); values.push(JSON.stringify(updates.planDetails)); }
    if (updates.details) { setClause.push('details = ?'); values.push(updates.details); }
    if (updates.parameters) { setClause.push('parameters = ?'); values.push(JSON.stringify(updates.parameters)); }
    if (updates.contentType) { setClause.push('content_type = ?'); values.push(updates.contentType); }
    if (updates.contentUrl) { setClause.push('content_url = ?'); values.push(updates.contentUrl); }
    if (updates.contentBlob !== undefined) { setClause.push('content_blob = ?'); values.push(updates.contentBlob ?? null); }
    if (updates.contentMime !== undefined) { setClause.push('content_mime = ?'); values.push(updates.contentMime ?? null); }
    if (updates.enabled !== undefined) { setClause.push('enabled = ?'); values.push(updates.enabled); }

    if (setClause.length === 0) {
      const existing = await getStrategyById(id);
      return existing ? { success: true, strategy: existing } : { success: false, error: 'Strategy not found' };
    }

    values.push(id);
    await pool.execute(`UPDATE strategies SET ${setClause.join(', ')} WHERE id = ?`, values);

    const updated = await getStrategyById(id);
    if (!updated) return { success: false, error: 'Failed to read updated strategy' };
    return { success: true, strategy: updated };
  } catch (error) {
    console.error('MySQL updateStrategy failed, falling back to JSON:', error);
    try {
      const db: any = readDatabase();
      const arr: any[] = Array.isArray(db.strategies) ? db.strategies : [];
      const idx = arr.findIndex((s: any) => s.id === id);
      if (idx === -1) return { success: false, error: 'Strategy not found' };
      const existing = arr[idx];
      const updated: Strategy = {
        ...existing,
        name: updates.name ?? existing.name,
        description: updates.description ?? existing.description,
        performance: updates.performance ?? existing.performance,
        riskLevel: updates.riskLevel ?? existing.riskLevel ?? existing.risk_level ?? 'Medium',
        category: updates.category ?? existing.category,
        imageUrl: updates.imageUrl ?? existing.imageUrl ?? existing.image_url,
        minCapital: updates.minCapital ?? (existing.minCapital ?? existing.min_capital),
        avgDrawdown: updates.avgDrawdown ?? (existing.avgDrawdown ?? existing.avg_drawdown),
        riskReward: updates.riskReward ?? (existing.riskReward ?? existing.risk_reward),
        winStreak: updates.winStreak ?? (existing.winStreak ?? existing.win_streak),
        tag: updates.tag ?? existing.tag,
        planPrices: updates.planPrices ?? (existing.planPrices ?? existing.plan_prices),
        planDetails: updates.planDetails ?? (existing.planDetails ?? existing.plan_details),
        details: updates.details ?? existing.details,
        parameters: updates.parameters ?? (typeof existing.parameters === 'string' ? JSON.parse(existing.parameters || '{}') : existing.parameters || {}),
        contentType: updates.contentType ?? existing.contentType,
        contentUrl: updates.contentUrl ?? existing.contentUrl,
        contentBlob: updates.contentBlob ?? existing.contentBlob,
        contentMime: updates.contentMime ?? existing.contentMime,
        enabled: updates.enabled ?? (existing.enabled !== false),
        created_at: existing.created_at,
        updated_at: new Date().toISOString()
      };
      arr[idx] = updated;
      db.strategies = arr;
      writeDatabase(db);
      return { success: true, strategy: updated };
    } catch (jsonError) {
      console.error('JSON fallback updateStrategy failed:', jsonError);
      return { success: false, error: 'Failed to update strategy locally' };
    }
  }
};

export const deleteStrategy = async (id: string): Promise<{ success: boolean; message?: string; error?: string }> => {
  // Attempt to remove associated uploaded files (icon and content) before deleting record
  const strategy = await getStrategyById(id);
  try {
    // Delete DB record
    await pool.execute('DELETE FROM strategies WHERE id = ?', [id]);
  } catch (error) {
    console.error('MySQL deleteStrategy failed, falling back to JSON:', error);
    try {
      const db: any = readDatabase();
      const arr: any[] = Array.isArray(db.strategies) ? db.strategies : [];
      const filtered = arr.filter((s: any) => s.id !== id);
      db.strategies = filtered;
      writeDatabase(db);
    } catch (jsonError) {
      console.error('JSON fallback deleteStrategy failed:', jsonError);
      return { success: false, error: 'Failed to delete strategy locally' };
    }
  }
  // Remove files from disk if they were uploaded to public/uploads paths
  try {
    const fs = await import('fs');
    const path = await import('path');
    const removeIfLocal = (url?: string) => {
      if (!url) return;
      if (url.startsWith('/uploads/')) {
        const filePath = path.join(process.cwd(), 'public', url.replace(/^\//, ''));
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) { console.warn('Failed to remove file', filePath, e); }
        }
      }
    };
    removeIfLocal(strategy?.imageUrl);
    removeIfLocal(strategy?.contentUrl);
  } catch (e) {
    console.warn('File removal encountered an issue:', e);
  }
  return { success: true, message: 'Strategy deleted' };
};

// User management functions
export const registerUser = async (userData: {
  name: string;
  email: string;
  password: string;
}): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    // Check if user already exists
    const [existingUsers] = await pool.execute('SELECT id FROM users WHERE email = ?', [userData.email]);
    
    if ((existingUsers as any[]).length > 0) {
      return { success: false, error: 'User already exists' };
    }

    const hashedPassword = await hashPassword(userData.password);
    const userId = `user_${Date.now()}`;

    await pool.execute(
      `INSERT INTO users (id, name, email, password, role, email_verified, wallet_balance) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, userData.name, userData.email, hashedPassword, 'USER', false, 0]
    );

    const user = await getUserById(userId);
    return { success: true, user: user! };
  } catch (error) {
    console.error('Error registering user:', error);
    return { success: false, error: 'Registration failed' };
  }
};

// Helper to ensure user exists in MySQL when coming from JSON fallback
const ensureUserExistsInMySQL = async (userId: string, name?: string, email?: string) => {
  try {
    const [rows] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if ((rows as any[]).length > 0) return;

    const db = readDatabase();
    const jsonUser = db.users?.find((u: any) => u.id === userId);
    if (jsonUser) {
      await pool.execute(
        `INSERT INTO users (id, name, email, password, wallet_balance, role, email_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          jsonUser.id,
          jsonUser.name || 'User',
          jsonUser.email,
          jsonUser.password,
          jsonUser.wallet_balance ?? 0,
          jsonUser.role ?? 'USER',
          jsonUser.email_verified ?? false,
        ]
      );
    } else if (name && email) {
      const hashedPassword = await hashPassword('generated');
      await pool.execute(
        `INSERT INTO users (id, name, email, password, wallet_balance, role, email_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          name,
          email,
          hashedPassword,
          0,
          'USER',
          false,
        ]
      );
    }
  } catch (error) {
    console.error('ensureUserExistsInMySQL failed:', error);
  }
};

export const loginUser = async (
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> => {
  // First, attempt MySQL-based login
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    const users = rows as any[];

    if (users.length > 0) {
      const user = users[0];
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return { success: false, error: 'Invalid password' };
      }

      const userWithHistory = await getUserById(user.id);
      if (userWithHistory) {
        return { success: true, user: userWithHistory };
      }
    }
  } catch (error) {
    console.error('MySQL login failed or unavailable. Falling back to JSON store.', error);
  }

  // Fallback: use JSON file store to support environments without MySQL
  try {
    const db = readDatabase();
    const user = db.users?.find((u: User) => u.email === email);

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return { success: false, error: 'Invalid password' };
    }

    // Sync JSON user to MySQL for downstream FK operations
    await ensureUserExistsInMySQL(user.id);

    return { success: true, user };
  } catch (error) {
    console.error('Fallback JSON login failed:', error);
    return { success: false, error: 'Login failed' };
  }
};

export const getUserById = async (id: string): Promise<User | null> => {
  try {
    const [userRows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    const users = userRows as any[];

    if (users.length === 0) return null;

    const user = users[0];
    
    // Get analysis history
    let analysis_history: any[] = [];
    try {
      const [historyRows] = await pool.execute(
        'SELECT * FROM analysis_history WHERE user_id = ? ORDER BY created_at DESC',
        [id]
      );
      analysis_history = (historyRows as any[]).map(row => ({
        ...row,
        created_at: row.created_at?.toISOString?.() ? row.created_at.toISOString() : row.created_at
      }));
    } catch (historyError: any) {
      // If the table is missing, return user without history instead of failing entirely
      if (historyError?.code === 'ER_NO_SUCH_TABLE' || historyError?.errno === 1146) {
        console.warn('analysis_history table missing; proceeding without history');
        analysis_history = [];
      } else {
        throw historyError;
      }
    }

    return {
      ...user,
      wallet_balance: parseFloat(user.wallet_balance),
      analysis_history,
      created_at: user.created_at.toISOString(),
      updated_at: user.updated_at.toISOString()
    };
  } catch (error) {
    console.error('MySQL getUserById failed, falling back to JSON:', error);
    try {
      const db: any = readDatabase();
      const users: any[] = Array.isArray(db.users) ? db.users : [];
      const user = users.find((u: any) => u.id === id);
      return user || null;
    } catch (jsonError) {
      console.error('JSON fallback getUserById failed:', jsonError);
      return null;
    }
  }
};

export const getAllUsers = async (): Promise<User[]> => {
  try {
    const [rows] = await pool.execute('SELECT * FROM users ORDER BY created_at DESC');
    const users = [];
    
    for (const user of rows as any[]) {
      const userWithHistory = await getUserById(user.id);
      if (userWithHistory) {
        users.push(userWithHistory);
      }
    }
    
    return users;
  } catch (error) {
    console.error('MySQL getAllUsers failed, falling back to JSON:', error);
    // JSON fallback: read users from local database.json
    try {
      const db: any = readDatabase();
      const users: any[] = Array.isArray(db.users) ? db.users : [];
      // Ensure wallet_balance is numeric and dates are strings
      return users.map((u: any) => ({
        ...u,
        wallet_balance: typeof u.wallet_balance === 'number' ? u.wallet_balance : parseFloat(u.wallet_balance || '0'),
        created_at: typeof u.created_at === 'string' ? u.created_at : (u.created_at?.toISOString?.() || undefined),
        updated_at: typeof u.updated_at === 'string' ? u.updated_at : (u.updated_at?.toISOString?.() || undefined),
      }));
    } catch (jsonError) {
      console.error('JSON fallback getAllUsers failed:', jsonError);
      return [];
    }
  }
};

export const updateUserTokens = async (userId: string, tokens: number): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    await pool.execute(
      'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
      [tokens, userId]
    );

    const user = await getUserById(userId);
    return { success: true, user: user! };
  } catch (error) {
    console.error('Error updating user tokens:', error);
    // JSON fallback for local testing when MySQL is unavailable
    try {
      const db: any = readDatabase();
      const users: any[] = Array.isArray(db.users) ? db.users : [];
      const idx = users.findIndex(u => u.id === userId);
      if (idx !== -1) {
        users[idx].wallet_balance = (users[idx].wallet_balance || 0) + tokens;
        users[idx].updated_at = new Date().toISOString();
        writeDatabase({ ...db, users });
        const user: User = { ...(users[idx] as User) };
        return { success: true, user };
      }
      return { success: false, error: 'User not found' };
    } catch (jsonError) {
      console.error('JSON fallback updateUserTokens failed:', jsonError);
      return { success: false, error: 'Failed to update tokens' };
    }
  }
};

// Wallet transaction functions
export const createWalletTransaction = async (transactionData: {
  user_id: string;
  user_name?: string;
  user_email?: string;
  amount: number;
  capital?: number;
  transaction_type: 'deposit' | 'charge';
  payment_method?: string;
  transaction_id?: string;
  receipt_path?: string;
  platform?: 'MT4' | 'MT5';
  mt_account_id?: string;
  mt_account_password?: string; // Stored as plain text per requirement
  mt_account_server?: string;
  terms_accepted?: boolean;
  strategy_id?: string;
  plan_level?: 'Premium' | 'Expert' | 'Pro';
  // New optional fields
  inr_amount?: number;
  inr_to_usd_rate?: number;
  crypto_network?: 'ERC20' | 'TRC20';
  crypto_wallet_address?: string;
  wallet_app_deeplink?: string;
}): Promise<WalletTransaction | null> => {
  try {
    const id = `trans_${Date.now()}`;

    // Ensure FK won't fail by syncing user if missing
    await ensureUserExistsInMySQL(transactionData.user_id, transactionData.user_name, transactionData.user_email);
    
    await pool.execute(
      `INSERT INTO wallet_transactions (id, user_id, amount, capital, transaction_type, payment_method, transaction_id, receipt_path, platform, mt_account_id, mt_account_password, mt_account_server, terms_accepted, strategy_id, plan_level, inr_amount, inr_to_usd_rate, crypto_network, crypto_wallet_address, wallet_app_deeplink, admin_message, admin_message_status, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        transactionData.user_id,
        transactionData.amount,
        transactionData.capital ?? null,
        transactionData.transaction_type,
        transactionData.payment_method || null,
        transactionData.transaction_id || null,
        transactionData.receipt_path || null,
        transactionData.platform || null,
        transactionData.mt_account_id || null,
        transactionData.mt_account_password || null,
        transactionData.mt_account_server || null,
        transactionData.terms_accepted ?? false,
        transactionData.strategy_id || null,
        transactionData.plan_level || null,
        transactionData.inr_amount ?? null,
        transactionData.inr_to_usd_rate ?? null,
        transactionData.crypto_network || null,
        transactionData.crypto_wallet_address || null,
        transactionData.wallet_app_deeplink || null,
        null,
        'pending',
        'pending'
      ]
    );

    return await getTransactionById(id);
  } catch (error) {
    console.error('MySQL createWalletTransaction failed, falling back to JSON:', error);
    try {
      const id = `trans_${Date.now()}`;
      const db: any = readDatabase();
      if (!Array.isArray(db.wallet_transactions)) db.wallet_transactions = [];
      const now = new Date().toISOString();
      const tx: WalletTransaction = {
        id,
        user_id: transactionData.user_id,
        amount: transactionData.amount,
        capital: transactionData.capital ?? undefined as any,
        transaction_type: transactionData.transaction_type,
        payment_method: transactionData.payment_method,
        transaction_id: transactionData.transaction_id,
        receipt_path: transactionData.receipt_path,
        platform: transactionData.platform,
        mt_account_id: transactionData.mt_account_id,
        mt_account_password: transactionData.mt_account_password,
        mt_account_server: transactionData.mt_account_server,
        terms_accepted: transactionData.terms_accepted ?? false,
        strategy_id: transactionData.strategy_id,
        plan_level: transactionData.plan_level,
        inr_amount: transactionData.inr_amount,
        inr_to_usd_rate: transactionData.inr_to_usd_rate,
        crypto_network: transactionData.crypto_network as any,
        crypto_wallet_address: transactionData.crypto_wallet_address,
        wallet_app_deeplink: transactionData.wallet_app_deeplink,
        admin_message: undefined,
        admin_message_status: 'pending',
        status: 'pending',
        created_at: now,
        updated_at: undefined,
      };
      db.wallet_transactions.push(tx);
      writeDatabase(db);
      return tx;
    } catch (jsonError) {
      console.error('JSON fallback create failed:', jsonError);
      return null;
    }
  }
};

export const getTransactionById = async (id: string): Promise<WalletTransaction | null> => {
  try {
    const [rows] = await pool.execute('SELECT * FROM wallet_transactions WHERE id = ?', [id]);
    const transactions = rows as any[];
    
    if (transactions.length === 0) return null;
    
    const transaction = transactions[0];
    return {
      ...transaction,
      amount: parseFloat(transaction.amount),
      created_at: transaction.created_at.toISOString(),
      updated_at: transaction.updated_at ? transaction.updated_at.toISOString() : undefined
    };
  } catch (error) {
    console.error('MySQL getTransactionById failed, falling back to JSON:', error);
    try {
      const db: any = readDatabase();
      const arr: any[] = Array.isArray(db.wallet_transactions) ? db.wallet_transactions : [];
      const transaction = arr.find(t => t.id === id);
      return transaction || null;
    } catch (jsonError) {
      console.error('JSON fallback getTransactionById failed:', jsonError);
      return null;
    }
  }
};

export const getPendingTransactions = async (): Promise<WalletTransaction[]> => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM wallet_transactions WHERE status = ? ORDER BY created_at DESC',
      ['pending']
    );
    
    return (rows as any[]).map(row => ({
      ...row,
      amount: parseFloat(row.amount),
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at ? row.updated_at.toISOString() : undefined
    }));
  } catch (error) {
    console.error('MySQL getPendingTransactions failed, falling back to JSON:', error);
    try {
      const db: any = readDatabase();
      const arr: any[] = Array.isArray(db.wallet_transactions) ? db.wallet_transactions : [];
      return arr
        .filter(t => t.status === 'pending')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (jsonError) {
      console.error('JSON fallback getPendingTransactions failed:', jsonError);
      return [];
    }
  }
};

export const getAllTransactions = async (): Promise<WalletTransaction[]> => {
  try {
    const [rows] = await pool.execute('SELECT * FROM wallet_transactions ORDER BY created_at DESC');

    // Overlay JSON fallback store in case some fields exist only there (e.g., admin_message)
    let jsonMap: Map<string, any> | null = null;
    try {
      const db: any = readDatabase();
      const arr: any[] = Array.isArray(db.wallet_transactions) ? db.wallet_transactions : [];
      jsonMap = new Map(arr.map(t => [t.id, t]));
    } catch {}

    return (rows as any[]).map(row => {
      const merged = { ...row };
      if (jsonMap && jsonMap.has(row.id)) {
        const j = jsonMap.get(row.id);
        if (typeof j.admin_message !== 'undefined') merged.admin_message = j.admin_message;
        if (typeof j.admin_message_status !== 'undefined') merged.admin_message_status = j.admin_message_status;
        if (typeof j.rejection_reason !== 'undefined') merged.rejection_reason = j.rejection_reason;
        if (typeof j.capital !== 'undefined') merged.capital = j.capital;
        if (typeof j.mt_account_server !== 'undefined') merged.mt_account_server = j.mt_account_server;
      }
      return {
        ...merged,
        amount: parseFloat(merged.amount),
        created_at: merged.created_at.toISOString(),
        updated_at: merged.updated_at ? merged.updated_at.toISOString() : undefined
      };
    });
  } catch (error) {
    console.error('MySQL getAllTransactions failed, falling back to JSON:', error);
    try {
      const db: any = readDatabase();
      const arr: any[] = Array.isArray(db.wallet_transactions) ? db.wallet_transactions : [];
      return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (jsonError) {
      console.error('JSON fallback getAllTransactions failed:', jsonError);
      return [];
    }
  }
};

export const updateTransactionStatus = async (
  transactionId: string,
  status: 'completed' | 'failed',
  adminId: string,
  tokensToAdd?: number,
  rejectionReason?: string
): Promise<{ success: boolean; transaction?: WalletTransaction; user?: Omit<User, 'password'> }> => {
  try {
    const transaction = await getTransactionById(transactionId);
    if (!transaction) {
      return { success: false };
    }

    // Update transaction status and optional rejection reason
    await pool.execute(
      'UPDATE wallet_transactions SET status = ?, admin_id = ?, rejection_reason = ? WHERE id = ?',
      [status, adminId, rejectionReason || null, transactionId]
    );

    let updatedUser = null;
    
    // If approved and tokens specified, add tokens to user account
    if (status === 'completed' && tokensToAdd && tokensToAdd > 0) {
      const tokenResult = await updateUserTokens(transaction.user_id, tokensToAdd);
      if (tokenResult.success) {
        updatedUser = tokenResult.user;
      }
    }

    const updatedTransaction = await getTransactionById(transactionId);
    return { success: true, transaction: updatedTransaction!, user: updatedUser as Omit<User, 'password'> | undefined };
  } catch (error) {
    console.error('Error updating transaction status:', error);
    // JSON fallback for local testing when MySQL is unavailable
    try {
      const db: any = readDatabase();
      const txs: any[] = Array.isArray(db.wallet_transactions) ? db.wallet_transactions : [];
      const idx = txs.findIndex(t => t.id === transactionId);
      if (idx === -1) {
        return { success: false };
      }

      txs[idx].status = status;
      txs[idx].admin_id = adminId;
      txs[idx].updated_at = new Date().toISOString();
      if (status === 'failed') {
        txs[idx].rejection_reason = rejectionReason || null;
      } else {
        // clear any previous rejection reason on approval
        txs[idx].rejection_reason = null;
      }

      let updatedUser: Omit<User, 'password'> | undefined = undefined;
      if (status === 'completed' && tokensToAdd && tokensToAdd > 0) {
        const users: any[] = Array.isArray(db.users) ? db.users : [];
        const uIdx = users.findIndex(u => u.id === txs[idx].user_id);
        if (uIdx !== -1) {
          users[uIdx].wallet_balance = (users[uIdx].wallet_balance || 0) + tokensToAdd;
          users[uIdx].updated_at = new Date().toISOString();
          updatedUser = { ...(users[uIdx] as Omit<User, 'password'>) };
        }
        writeDatabase({ ...db, users, wallet_transactions: txs });
      } else {
        writeDatabase({ ...db, wallet_transactions: txs });
      }

      const updatedTransaction = txs[idx] as WalletTransaction;
      return { success: true, transaction: updatedTransaction, user: updatedUser };
    } catch (jsonError) {
      console.error('JSON fallback updateTransactionStatus failed:', jsonError);
      return { success: false };
    }
  }
};

// This function was removed to avoid duplication with the existing sendEmailNotification function

// Analytics data
export const getAnalyticsData = async () => {
  try {
    // Get user count
    const [userRows] = await pool.execute('SELECT COUNT(*) as count FROM users');
    const totalUsers = (userRows as any[])[0].count;

    // Get payment count and revenue
    const [paymentRows] = await pool.execute(
      'SELECT COUNT(*) as count, SUM(amount) as revenue FROM wallet_transactions WHERE status = "completed"'
    );
    const paymentData = (paymentRows as any[])[0];
    const totalPayments = paymentData.count || 0;
    const totalRevenue = parseFloat(paymentData.revenue || 0);

    // Get strategy count
    const [strategyRows] = await pool.execute('SELECT COUNT(*) as count FROM strategies');
    const totalStrategies = (strategyRows as any[])[0].count;

    // Get user status distribution
    const [activeUserRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE stock_analysis_access = true'
    );
    const activeUsers = (activeUserRows as any[])[0].count;
    const inactiveUsers = totalUsers - activeUsers;

    // Get payment status distribution
    const [pendingPaymentRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM wallet_transactions WHERE status = "pending"'
    );
    const pendingPayments = (pendingPaymentRows as any[])[0].count;
    const completedPayments = totalPayments;

    return {
      totalUsers,
      totalPayments,
      totalRevenue,
      totalStrategies,
      userStatusData: [
        { name: 'Active', value: activeUsers, color: '#10b981' },
        { name: 'Inactive', value: inactiveUsers, color: '#ef4444' }
      ],
      paymentStatusData: [
        { name: 'Completed', value: completedPayments, color: '#10b981' },
        { name: 'Pending', value: pendingPayments, color: '#f59e0b' }
      ],
      systemOverview: [
        { name: 'Users', value: totalUsers },
        { name: 'Payments', value: totalPayments },
        { name: 'Strategies', value: totalStrategies }
      ]
    };
  } catch (error) {
    console.error('Error getting analytics data:', error);
    // JSON fallback for local testing when MySQL is unavailable
    try {
      const db: any = readDatabase();
      const users: any[] = Array.isArray(db.users) ? db.users : [];
      const txs: any[] = Array.isArray(db.wallet_transactions) ? db.wallet_transactions : [];
      const strategies: any[] = Array.isArray(db.strategies) ? db.strategies : [];

      const totalUsers = users.length;
      const completedTxs = txs.filter(t => t.status === 'completed');
      const totalPayments = completedTxs.length;
      const totalRevenue = completedTxs.reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalStrategies = strategies.length;

      const activeUsers = users.filter(u => (u.stock_analysis_access === true) || (u.wallet_balance && u.wallet_balance > 0)).length;
      const inactiveUsers = totalUsers - activeUsers;
      const pendingPayments = txs.filter(t => t.status === 'pending').length;

      return {
        totalUsers,
        totalPayments,
        totalRevenue,
        totalStrategies,
        userStatusData: [
          { name: 'Active', value: activeUsers, color: '#10b981' },
          { name: 'Inactive', value: inactiveUsers, color: '#ef4444' }
        ],
        paymentStatusData: [
          { name: 'Completed', value: totalPayments, color: '#10b981' },
          { name: 'Pending', value: pendingPayments, color: '#f59e0b' }
        ],
        systemOverview: [
          { name: 'Users', value: totalUsers },
          { name: 'Payments', value: totalPayments },
          { name: 'Strategies', value: totalStrategies }
        ]
      };
    } catch (jsonError) {
      console.error('JSON fallback getAnalyticsData failed:', jsonError);
      return {
        totalUsers: 0,
        totalPayments: 0,
        totalRevenue: 0,
        totalStrategies: 0,
        userStatusData: [],
        paymentStatusData: [],
        systemOverview: []
      };
    }
  }
};


// Email notification function (simulated)
export const sendEmailNotification = async (
  email: string,
  subject: string,
  content: string
): Promise<{ success: boolean }> => {
  try {
    // In a real implementation, this would send an actual email
    console.log(`Simulating email to ${email}: ${subject}\n${content}`);
    
    // For simulation purposes, return success
    return { success: true };
  } catch (error) {
    console.error('Error sending email notification:', error);
    return { success: false };
  }
};

export const syncJsonToMysql = async (): Promise<{ success: boolean; inserted: number; skipped: number; error?: string }> => {
  try {
    const db = readDatabase() as any;
    const users: any[] = Array.isArray(db?.users) ? db.users : [];
    if (users.length === 0) {
      return { success: true, inserted: 0, skipped: 0 };
    }
  
    let inserted = 0;
    let skipped = 0;
  
    for (const u of users) {
      const id = u.id;
      const email = u.email;
      if (!id || !email) { skipped++; continue; }
  
      // Check existence by id or email
      const [rows] = await pool.execute('SELECT id FROM users WHERE id = ? OR email = ?', [id, email]);
      if ((rows as any[]).length > 0) {
        skipped++;
        continue;
      }
  
      // Ensure we have a hashed password; if not, create a default one
      let passwordToUse: string = u.password;
      if (!passwordToUse || passwordToUse.length < 10) {
        passwordToUse = await hashPassword('changeme123');
      }
  
      await pool.execute(
        `INSERT INTO users (id, name, email, password, wallet_balance, stock_analysis_access, analysis_count, trial_expiry, role, email_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          u.name || 'User',
          email,
          passwordToUse,
          u.wallet_balance ?? 0,
          u.stock_analysis_access ?? false,
          u.analysis_count ?? 0,
          u.trial_expiry ?? false,
          u.role ?? 'USER',
          u.email_verified ?? false,
        ]
      );
      inserted++;
    }
  
    return { success: true, inserted, skipped };
  } catch (error) {
    console.error('syncJsonToMysql failed:', error);
    return { success: false, inserted: 0, skipped: 0, error: 'Sync failed' };
  }
};

// Update transaction proof (receipt_path) and tx id, optionally status
export const updateTransactionProof = async (
  transactionId: string,
  txId: string,
  proofUrl: string,
  nextStatus: 'pending' | 'in-process' | 'completed' | 'failed' = 'in-process'
): Promise<WalletTransaction | null> => {
  try {
    await pool.execute(
      'UPDATE wallet_transactions SET transaction_id = ?, receipt_path = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [txId, proofUrl, nextStatus, transactionId]
    );
    const updated = await getTransactionById(transactionId);
    if (updated && updated.status === 'in-process' && updated.strategy_id && updated.user_id) {
      try {
        const runningId = `run_${Date.now()}`;
        const [existing] = await pool.execute(
          'SELECT id FROM running_strategies WHERE user_id = ? AND strategy_id = ?',
          [updated.user_id, updated.strategy_id]
        );
        if (!(Array.isArray(existing) && (existing as any[]).length > 0)) {
          await pool.execute(
            `INSERT INTO running_strategies (id, user_id, strategy_id, plan, capital, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [runningId, updated.user_id, updated.strategy_id, updated.plan_level ?? null, updated.amount ?? 0, 'in-process']
          );
        }
      } catch (e) {
        console.error('Failed to create running strategy from transaction:', e);
      }
    }
    return updated;
  } catch (error) {
    console.error('MySQL updateTransactionProof failed, falling back to JSON:', error);
    try {
      const db: any = readDatabase();
      const arr: any[] = Array.isArray(db.wallet_transactions) ? db.wallet_transactions : [];
      const idx = arr.findIndex(t => t.id === transactionId);
      if (idx === -1) return null;
      arr[idx].transaction_id = txId;
      arr[idx].receipt_path = proofUrl;
      arr[idx].status = nextStatus;
      arr[idx].updated_at = new Date().toISOString();
      if (nextStatus === 'in-process' && arr[idx].strategy_id && arr[idx].user_id) {
        const runs: any[] = Array.isArray(db.running_strategies) ? db.running_strategies : [];
        const exists = runs.find((r: any) => r.user_id === arr[idx].user_id && r.strategy_id === arr[idx].strategy_id);
        if (!exists) {
          runs.push({
            id: `run_${Date.now()}`,
            user_id: arr[idx].user_id,
            strategy_id: arr[idx].strategy_id,
            plan: arr[idx].plan_level,
            capital: arr[idx].amount,
            status: 'in-process',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          db.running_strategies = runs;
        }
      }
      writeDatabase({ ...db, wallet_transactions: arr });
      return arr[idx] as WalletTransaction;
    } catch (jsonError) {
      console.error('JSON fallback updateTransactionProof failed:', jsonError);
      return null;
    }
  }
};

// Fetch pending or in-process transactions for admin
export const getPendingOrInProcessTransactions = async (): Promise<WalletTransaction[]> => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM wallet_transactions WHERE status IN ('pending','in-process','in_process') ORDER BY created_at DESC"
    );
    return (rows as any[]).map(row => ({
      ...row,
      amount: parseFloat(row.amount),
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at ? row.updated_at.toISOString() : undefined
    }));
  } catch (error) {
    try {
      const db: any = readDatabase();
      const arr: any[] = Array.isArray(db.wallet_transactions) ? db.wallet_transactions : [];
      return arr.filter(t => t.status === 'pending' || t.status === 'in-process' || t.status === 'in_process');
    } catch (jsonError) {
      console.error('Failed to load pending/in-process transactions:', jsonError);
      return [];
    }
  }
};

// Admin user CRUD operations (MySQL-backed)
export const createUserAdmin = async (
  {
    name,
    email,
    password,
    role = 'USER',
    enabled = true,
  }: { name: string; email: string; password: string; role?: 'USER' | 'ADMIN'; enabled?: boolean }
): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if ((existing as any[]).length > 0) {
      return { success: false, error: 'A user with this email already exists' };
    }

    const hashedPassword = await hashPassword(password);
    const userId = `user_${Date.now()}`;
    await pool.execute(
      `INSERT INTO users (id, name, email, password, role, email_verified, wallet_balance, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, email, hashedPassword, role, false, 0, enabled]
    );

    const user = await getUserById(userId);
    return { success: true, user: user! };
  } catch (error) {
    console.error('createUserAdmin failed:', error);
    return { success: false, error: 'Failed to add user' };
  }
};

export const updateUserAdmin = async (
  id: string,
  updates: { name?: string; email?: string; role?: 'USER' | 'ADMIN'; enabled?: boolean }
): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    const fields: string[] = [];
    const values: any[] = [];

    if (typeof updates.name !== 'undefined') { fields.push('name = ?'); values.push(updates.name); }
    if (typeof updates.email !== 'undefined') { fields.push('email = ?'); values.push(updates.email); }
    if (typeof updates.role !== 'undefined') { fields.push('role = ?'); values.push(updates.role); }
    if (typeof updates.enabled !== 'undefined') { fields.push('enabled = ?'); values.push(!!updates.enabled); }

    if (fields.length === 0) {
      const user = await getUserById(id);
      return user ? { success: true, user } : { success: false, error: 'User not found' };
    }

    values.push(id);
    const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await pool.execute(sql, values);
    const user = await getUserById(id);
    return user ? { success: true, user } : { success: false, error: 'User not found' };
  } catch (error) {
    console.error('updateUserAdmin failed:', error);
    return { success: false, error: 'Failed to update user' };
  }
};

export const deleteUserAdmin = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Prevent deleting hardcoded admin
    if (id === 'admin123') {
      return { success: false, error: 'Cannot delete the admin account' };
    }
    const [rows] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
    if ((rows as any[]).length === 0) {
      return { success: false, error: 'User not found' };
    }
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('deleteUserAdmin failed:', error);
    return { success: false, error: 'Failed to delete user' };
  }
};

// Fetch running strategies for a user from MySQL
export const getRunningStrategiesForUser = async (
  userId: string
): Promise<{
  id: string;
  strategyName: string;
  status: string;
  adminStatus: string;
  updatedAt: string;
  platform?: 'MT4' | 'MT5' | null;
  mtAccountId?: string | null;
  mtAccountPassword?: string | null;
  mtAccountServer?: string | null;
}[]> => {
  try {
    const [rows] = await pool.execute(
      `SELECT rs.id,
              s.name AS strategyName,
              rs.status,
              rs.admin_status AS adminStatus,
              rs.updated_at AS updatedAt,
              wt.platform AS platform,
              wt.mt_account_id AS mtAccountId,
              wt.mt_account_password AS mtAccountPassword,
              wt.mt_account_server AS mtAccountServer
       FROM running_strategies rs
       JOIN strategies s ON s.id = rs.strategy_id
       LEFT JOIN wallet_transactions wt ON wt.id = (
         SELECT id FROM wallet_transactions
         WHERE user_id = rs.user_id AND strategy_id = rs.strategy_id
         ORDER BY created_at DESC LIMIT 1
       )
       WHERE rs.user_id = ? AND rs.status IN ('in-process','active')
       ORDER BY rs.created_at DESC`,
      [userId]
    );

    return (rows as any[]).map((r) => ({
      id: r.id,
      strategyName: r.strategyName,
      status: r.status,
      adminStatus: r.adminStatus,
      updatedAt: r.updatedAt,
      platform: r.platform ?? null,
      mtAccountId: r.mtAccountId ?? null,
      mtAccountPassword: r.mtAccountPassword ?? null,
      mtAccountServer: r.mtAccountServer ?? null,
    }));
  } catch (error) {
    console.error('Error fetching running strategies:', error);
    return [];
  }
};

// Admin: fetch running strategies with richer fields
export const getRunningStrategiesAdmin = async (): Promise<
  Array<{
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    strategyId: string;
    strategyName: string;
    plan: 'Pro' | 'Expert' | 'Premium';
    capital: number;
    status: 'in-process' | 'active' | 'stopped';
    adminStatus: 'in-process' | 'wrong-account-password' | 'wrong-account-id' | 'wrong-account-server-name' | 'running';
    platform?: 'MT4' | 'MT5' | null;
    mtAccountId?: string | null;
    mtAccountPassword?: string | null;
    mtAccountServer?: string | null;
    createdAt: string;
  }>
> => {
  try {
    const [rows] = await pool.execute(
      `SELECT rs.id, rs.user_id AS userId, u.name AS userName, u.email AS userEmail,
              rs.strategy_id AS strategyId, s.name AS strategyName, rs.plan, rs.capital, rs.status, rs.admin_status AS adminStatus,
              wt.platform AS platform, wt.mt_account_id AS mtAccountId, wt.mt_account_password AS mtAccountPassword, wt.mt_account_server AS mtAccountServer,
              DATE_FORMAT(rs.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
       FROM running_strategies rs
       JOIN users u ON u.id = rs.user_id
       JOIN strategies s ON s.id = rs.strategy_id
       LEFT JOIN wallet_transactions wt
         ON wt.user_id = rs.user_id AND wt.strategy_id = rs.strategy_id
         AND wt.created_at = (
           SELECT MAX(created_at) FROM wallet_transactions w2
           WHERE w2.user_id = rs.user_id AND w2.strategy_id = rs.strategy_id
         )
       WHERE rs.status IN ('in-process','active')
       ORDER BY rs.created_at DESC`
    );

    return (rows as any[]).map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      userEmail: r.userEmail,
      strategyId: r.strategyId,
      strategyName: r.strategyName,
      plan: r.plan,
      capital: Number(r.capital),
      status: r.status,
      adminStatus: r.adminStatus,
      platform: r.platform ?? null,
      mtAccountId: r.mtAccountId ?? null,
      mtAccountPassword: r.mtAccountPassword ?? null,
      mtAccountServer: r.mtAccountServer ?? null,
      createdAt: r.createdAt,
    }));
  } catch (error) {
    console.error('getRunningStrategiesAdmin failed:', error);
    return [];
  }
};

export const updateRunningStrategyAdminStatus = async (
  id: string,
  status: 'in-process' | 'wrong-account-password' | 'wrong-account-id' | 'wrong-account-server-name' | 'running'
) => {
  try {
    await pool.execute('UPDATE running_strategies SET admin_status = ? WHERE id = ?', [status, id]);
    return { success: true };
  } catch (error) {
    try {
      const db: any = readDatabase();
      const runs: any[] = Array.isArray(db.running_strategies) ? db.running_strategies : [];
      const idx = runs.findIndex((r: any) => r.id === id);
      if (idx !== -1) {
        runs[idx].admin_status = status;
        writeDatabase({ ...db, running_strategies: runs });
        return { success: true };
      }
      return { success: false };
    } catch (e) {
      return { success: false };
    }
  }
};

export const setTransactionAdminMessage = async (
  transactionId: string,
  adminId: string,
  message: string,
  messageStatus: 'pending' | 'sent' | 'resolved' = 'pending'
): Promise<WalletTransaction | null> => {
  try {
    const existing = await getTransactionById(transactionId);
    if (!existing) return null;
    await pool.execute(
      'UPDATE wallet_transactions SET admin_id = ?, admin_message = ?, admin_message_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [adminId, message, messageStatus, transactionId]
    );
    const updated = await getTransactionById(transactionId);
    return updated;
  } catch (error) {
    try {
      const db: any = readDatabase();
      const arr: any[] = Array.isArray(db.wallet_transactions) ? db.wallet_transactions : [];
      const idx = arr.findIndex(t => t.id === transactionId);
      if (idx === -1) return null;
      arr[idx].admin_id = adminId;
      arr[idx].admin_message = message;
      arr[idx].admin_message_status = messageStatus;
      arr[idx].updated_at = new Date().toISOString();
      writeDatabase({ ...db, wallet_transactions: arr });
      return arr[idx] as WalletTransaction;
    } catch (jsonError) {
      return null;
    }
  }
};

export const deleteRunningStrategyForUserStrategy = async (
  userId: string,
  strategyId: string
): Promise<{ success: boolean }> => {
  try {
    await pool.execute('DELETE FROM running_strategies WHERE user_id = ? AND strategy_id = ?', [userId, strategyId]);
    return { success: true };
  } catch (error) {
    try {
      const db: any = readDatabase();
      const runs: any[] = Array.isArray(db.running_strategies) ? db.running_strategies : [];
      const filtered = runs.filter((r: any) => !(r.user_id === userId && r.strategy_id === strategyId));
      db.running_strategies = filtered;
      writeDatabase(db);
      return { success: true };
    } catch (jsonError) {
      return { success: false };
    }
  }
};

export const createRunningStrategyModification = async (
  payload: {
    id: string;
    running_strategy_id: string;
    user_id: string;
    platform?: 'MT4' | 'MT5' | null;
    mt_account_id?: string | null;
    mt_account_password?: string | null;
    mt_account_server?: string | null;
    status: 'in-process' | 'wrong-account-password' | 'wrong-account-id' | 'wrong-account-server-name' | 'running';
    new_update_json?: any;
  }
) => {
  try {
    await pool.execute(
      'INSERT INTO running_strategy_modifications (id, running_strategy_id, user_id, platform, mt_account_id, mt_account_password, mt_account_server, status, new_update_json) VALUES (?,?,?,?,?,?,?,?,?)',
      [
        payload.id,
        payload.running_strategy_id,
        payload.user_id,
        payload.platform ?? null,
        payload.mt_account_id ?? null,
        payload.mt_account_password ?? null,
        payload.mt_account_server ?? null,
        payload.status,
        JSON.stringify(payload.new_update_json ?? {}),
      ]
    );
    return { success: true };
  } catch (error) {
    try {
      const db: any = readDatabase();
      const mods: any[] = Array.isArray(db.running_strategy_modifications) ? db.running_strategy_modifications : [];
      mods.push({ ...payload, new_update_json: payload.new_update_json, created_at: new Date().toISOString() });
      writeDatabase({ ...db, running_strategy_modifications: mods });
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  }
};

export const getRunningStrategyModificationsAdmin = async (): Promise<any[]> => {
  try {
    const [rows] = await pool.execute('SELECT * FROM running_strategy_modifications ORDER BY created_at DESC');
    return rows as any[];
  } catch (error) {
    try {
      const db: any = readDatabase();
      const mods: any[] = Array.isArray(db.running_strategy_modifications) ? db.running_strategy_modifications : [];
      return mods;
    } catch (e) {
      return [];
    }
  }
};

export const updateRunningStrategyMtDetails = async (
  id: string,
  updates: { platform?: 'MT4' | 'MT5'; mt_account_password?: string; mt_account_server?: string }
): Promise<{ success: boolean }> => {
  try {
    const [rsRows] = await pool.execute('SELECT user_id, strategy_id FROM running_strategies WHERE id = ?', [id]);
    const rsArr = rsRows as any[];
    if (!rsArr.length) return { success: false };
    const { user_id, strategy_id } = rsArr[0];
    const [txRows] = await pool.execute(
      'SELECT id FROM wallet_transactions WHERE user_id = ? AND strategy_id = ? ORDER BY created_at DESC LIMIT 1',
      [user_id, strategy_id]
    );
    const txArr = txRows as any[];
    if (!txArr.length) return { success: false };
    const txId = txArr[0].id;
    const fields: string[] = [];
    const values: any[] = [];
    if (typeof updates.platform !== 'undefined') { fields.push('platform = ?'); values.push(updates.platform); }
    if (typeof updates.mt_account_password !== 'undefined') { fields.push('mt_account_password = ?'); values.push(updates.mt_account_password); }
    if (typeof updates.mt_account_server !== 'undefined') { fields.push('mt_account_server = ?'); values.push(updates.mt_account_server); }
    if (fields.length === 0) return { success: true };
    values.push(txId);
    await pool.execute(`UPDATE wallet_transactions SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
    return { success: true };
  } catch (error) {
    try {
      const db: any = readDatabase();
      const runs: any[] = Array.isArray(db.running_strategies) ? db.running_strategies : [];
      const rs = runs.find((r: any) => r.id === id);
      if (!rs) return { success: false };
      const txs: any[] = Array.isArray(db.wallet_transactions) ? db.wallet_transactions : [];
      const latest = txs
        .filter((t: any) => t.user_id === rs.user_id && t.strategy_id === rs.strategy_id)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      if (!latest) return { success: false };
      if (typeof updates.platform !== 'undefined') latest.platform = updates.platform;
      if (typeof updates.mt_account_password !== 'undefined') latest.mt_account_password = updates.mt_account_password;
      if (typeof updates.mt_account_server !== 'undefined') latest.mt_account_server = updates.mt_account_server;
      latest.updated_at = new Date().toISOString();
      writeDatabase({ ...db, wallet_transactions: txs });
      return { success: true };
    } catch (jsonError) {
      return { success: false };
    }
  }
};