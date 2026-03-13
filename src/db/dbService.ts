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
  phone?: string;
  country_code?: string;
  country?: string;
  enabled?: boolean;
  password_updated_at?: string;
  email_updated_at?: string;
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
  roi?: number;
  profit?: number;
  maxDdi?: number;
  copiers?: number;
  riskScore?: number;
  // Tag
  tag?: string;
  mastersTag?: string;
  // Master Account Details (Admin Only)
  masterAccountId?: string;
  masterAccountPassword?: string;
  masterAccountServer?: string;
  masterPlatform?: 'MT4' | 'MT5';
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
  iconBlob?: Buffer;
  iconMime?: string;
  enabled?: boolean;
  created_at: string;
  updated_at: string;
};

export type Ad = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  linkUrl?: string;
  position: 'top' | 'bottom' | 'sidebar';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// Ensure master_trades_cache table exists immediately (for Vercel/production)
const ensureMasterTradesTable = async () => {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS master_trades_cache (
        id VARCHAR(255) PRIMARY KEY,
        master_id VARCHAR(255) NOT NULL,
        position_id VARCHAR(255) NOT NULL,
        symbol VARCHAR(50) NOT NULL,
        type ENUM('BUY', 'SELL') NOT NULL,
        volume DECIMAL(18,2) NOT NULL,
        price_open DECIMAL(18,5) NOT NULL,
        price_close DECIMAL(18,5),
        profit DECIMAL(18,2) DEFAULT 0,
        commission DECIMAL(18,2) DEFAULT 0,
        swap DECIMAL(18,2) DEFAULT 0,
        time_open TIMESTAMP NOT NULL,
        time_close TIMESTAMP,
        is_open BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_master_id (master_id),
        INDEX idx_position_id (position_id),
        INDEX idx_time_open (time_open)
      )
    `);
    console.log('master_trades_cache table ensured');
  } catch (error) {
    console.warn('Failed to ensure master_trades_cache table:', error);
  }
};

// Call immediately when module loads
ensureMasterTradesTable();

// Initialize database with MySQL connection
const initializeDatabase = async () => {
  try {
    try {
      const conn = await pool.getConnection();
      console.log('MySQL connection successful');
      conn.release();
    } catch (err) {
      console.log('MySQL connection failed, using JSON fallback');
    }

    // Create essential tables immediately (especially for Vercel)
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS master_trades (
          id VARCHAR(255) PRIMARY KEY,
          master_id VARCHAR(255) NOT NULL,
          position_id VARCHAR(255) NOT NULL,
          symbol VARCHAR(50) NOT NULL,
          type ENUM('BUY', 'SELL') NOT NULL,
          volume DECIMAL(18,2) NOT NULL,
          price_open DECIMAL(18,5) NOT NULL,
          price_close DECIMAL(18,5),
          profit DECIMAL(18,2) DEFAULT 0,
          commission DECIMAL(18,2) DEFAULT 0,
          swap DECIMAL(18,2) DEFAULT 0,
          time_open TIMESTAMP NOT NULL,
          time_close TIMESTAMP,
          is_open BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_master_id (master_id),
          INDEX idx_position_id (position_id),
          INDEX idx_time_open (time_open)
        )
      `);
      console.log('master_trades table created/verified');
    } catch (tableError) {
      console.warn('master_trades table creation failed:', tableError);
    }

    try {
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
    } catch (e) {
      return;
    }
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
    try { await pool.execute("ALTER TABLE users ADD COLUMN phone VARCHAR(32) NULL"); } catch (e) {}
    try { await pool.execute("ALTER TABLE users ADD COLUMN password_updated_at TIMESTAMP NULL"); } catch (e) {}
    try { await pool.execute("ALTER TABLE users ADD COLUMN email_updated_at TIMESTAMP NULL"); } catch (e) {}
    try { await pool.execute("ALTER TABLE users ADD COLUMN country_code VARCHAR(8) NULL"); } catch (e) {}
    try { await pool.execute("ALTER TABLE users ADD COLUMN country VARCHAR(100) NULL"); } catch (e) {}
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
        admin_status ENUM('in-process','wrong-account-password','wrong-account-id','wrong-account-server-name','running','disconnected') DEFAULT 'in-process',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
      )
    `);
    try { await pool.execute("ALTER TABLE running_strategies DROP INDEX uniq_user_strategy"); } catch (e) {}
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS running_strategy_modifications (
        id VARCHAR(255) PRIMARY KEY,
        running_strategy_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        platform ENUM('MT4','MT5'),
        mt_account_id VARCHAR(255),
        mt_account_password VARCHAR(255),
        mt_account_server VARCHAR(255),
        status ENUM('in-process','wrong-account-password','wrong-account-id','wrong-account-server-name','running','disconnected') DEFAULT 'in-process',
        new_update_json JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (running_strategy_id) REFERENCES running_strategies(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  try { await pool.execute("ALTER TABLE running_strategies ADD COLUMN admin_status ENUM('in-process','wrong-account-password','wrong-account-id','wrong-account-server-name','running','disconnected') DEFAULT 'in-process'"); } catch (e) {}
  try { await pool.execute("ALTER TABLE running_strategy_modifications MODIFY COLUMN status ENUM('in-process','wrong-account-password','wrong-account-id','wrong-account-server-name','running','disconnected') DEFAULT 'in-process'"); } catch (e) {}
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
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN masters_tag VARCHAR(255)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN plan_prices JSON"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN plan_details JSON"); } catch (e) {}
  // Master Account Details
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN master_account_id VARCHAR(255)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN master_account_password VARCHAR(255)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN master_account_server VARCHAR(255)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN master_platform ENUM('MT4', 'MT5')"); } catch (e) {}
  // Binary content storage for Vercel-safe uploads
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN content_blob LONGBLOB"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN content_mime VARCHAR(255)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN icon_blob LONGBLOB"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN icon_mime VARCHAR(255)"); } catch (e) {}
  // New metrics
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN roi DECIMAL(8,2)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN profit DECIMAL(14,2)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN max_ddi DECIMAL(8,2)"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN copiers INT"); } catch (e) {}
  try { await pool.execute("ALTER TABLE strategies ADD COLUMN risk_score DECIMAL(8,2)"); } catch (e) {}
    try { await pool.execute("ALTER TABLE analysis_history ADD COLUMN score DECIMAL(6,2)"); } catch (e) {}
    try { await pool.execute("ALTER TABLE analysis_history ADD INDEX idx_analysis_user (user_id, created_at)"); } catch (e) {}

    // Create disconnect_snapshots table (without foreign key first, then add it)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS disconnect_snapshots (
        id VARCHAR(255) PRIMARY KEY,
        running_strategy_id VARCHAR(255) NOT NULL,
        snapshot_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Try to add foreign key constraint separately
    try {
      await pool.execute(`
        ALTER TABLE disconnect_snapshots 
        ADD CONSTRAINT fk_disconnect_snapshots_running_strategy 
        FOREIGN KEY (running_strategy_id) REFERENCES running_strategies(id) ON DELETE CASCADE
      `);
    } catch (e) {
      console.warn('Could not add foreign key constraint for disconnect_snapshots:', e);
    }

    console.log('Database tables initialized successfully');
    
    // Create master_trades_cache table for storing master account trade history
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS master_trades_cache (
        id VARCHAR(255) PRIMARY KEY,
        master_id VARCHAR(255) NOT NULL,
        position_id VARCHAR(255) NOT NULL,
        symbol VARCHAR(50) NOT NULL,
        type ENUM('BUY', 'SELL') NOT NULL,
        volume DECIMAL(18,2) NOT NULL,
        price_open DECIMAL(18,5) NOT NULL,
        price_close DECIMAL(18,5),
        profit DECIMAL(18,2) DEFAULT 0,
        commission DECIMAL(18,2) DEFAULT 0,
        swap DECIMAL(18,2) DEFAULT 0,
        time_open TIMESTAMP NOT NULL,
        time_close TIMESTAMP,
        is_open BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_master_id (master_id),
        INDEX idx_position_id (position_id),
        INDEX idx_time_open (time_open)
      )
    `);
    
    // Create trades table for storing user trade history
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS trades (
        id VARCHAR(255) PRIMARY KEY,
        running_strategy_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        symbol VARCHAR(50) NOT NULL,
        type ENUM('BUY', 'SELL') NOT NULL,
        volume DECIMAL(18,2) NOT NULL,
        open_price DECIMAL(18,5) NOT NULL,
        close_price DECIMAL(18,5),
        stop_loss DECIMAL(18,5),
        take_profit DECIMAL(18,5),
        profit DECIMAL(18,2),
        commission DECIMAL(18,2),
        swap DECIMAL(18,2),
        open_time TIMESTAMP NOT NULL,
        close_time TIMESTAMP,
        status ENUM('OPEN', 'CLOSED', 'CANCELLED') DEFAULT 'OPEN',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (running_strategy_id) REFERENCES running_strategies(id),
        INDEX idx_user_strategy (user_id, running_strategy_id),
        INDEX idx_symbol (symbol),
        INDEX idx_status (status)
      )
    `);
    
     // Sync JSON to MySQL on startup to ensure all users are available
    try {
      const syncResult = await syncJsonToMysql();
      console.log(`Sync JSON to MySQL: Inserted ${syncResult.inserted}, Skipped ${syncResult.skipped}`);
    } catch (syncError) {
      console.error('Initial sync JSON to MySQL failed:', syncError);
    }
    
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

// Initialize database on startup - DISABLED for Vercel performance
// Database initialization should be triggered manually or via a separate migration script
// to avoid timeouts on serverless function cold starts.
// export const initDB = () => initializeDatabase().catch(err => console.error('Database initialization failed:', err));
export { initializeDatabase };

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
        roi: s.roi,
        profit: s.profit,
        maxDdi: s.maxDdi ?? s.max_ddi,
        copiers: s.copiers,
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
      roi: row.roi !== undefined ? Number(row.roi) : undefined,
      profit: row.profit !== undefined ? Number(row.profit) : undefined,
      maxDdi: row.max_ddi !== undefined ? Number(row.max_ddi) : undefined,
      copiers: row.copiers !== undefined ? Number(row.copiers) : undefined,
      riskScore: row.risk_score !== undefined ? Number(row.risk_score) : undefined,
      tag: row.tag,
      mastersTag: row.masters_tag,
      planPrices: typeof row.plan_prices === 'string' ? JSON.parse(row.plan_prices) : row.plan_prices,
      planDetails: typeof row.plan_details === 'string' ? JSON.parse(row.plan_details) : row.plan_details,
      parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters || '{}') : (row.parameters || {}),
      contentType: row.content_type,
      contentUrl: row.content_url,
      enabled: row.enabled !== undefined ? !!row.enabled : true,
      masterAccountId: row.master_account_id,
      masterAccountPassword: row.master_account_password,
      masterAccountServer: row.master_account_server,
      masterPlatform: row.master_platform,
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
        roi: s.roi,
        profit: s.profit,
        maxDdi: s.maxDdi ?? s.max_ddi,
        copiers: s.copiers,
        tag: s.tag,
        mastersTag: s.mastersTag ?? s.masters_tag,
        planPrices: s.planPrices ?? s.plan_prices,
        planDetails: s.planDetails ?? s.plan_details,
        parameters: typeof s.parameters === 'string' ? JSON.parse(s.parameters || '{}') : (s.parameters || {}),
        contentType: s.contentType ?? s.content_type,
        contentUrl: s.contentUrl ?? s.content_url,
        enabled: s.enabled !== false,
        masterAccountId: s.masterAccountId ?? s.master_account_id,
        masterAccountPassword: s.masterAccountPassword ?? s.master_account_password,
        masterAccountServer: s.masterAccountServer ?? s.master_account_server,
        masterPlatform: s.masterPlatform ?? s.master_platform,
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
    
    if (strategies.length > 0) {
      const strategy = strategies[0];
      return {
        ...strategy,
        riskLevel: strategy.risk_level,
        imageUrl: strategy.image_url,
        minCapital: strategy.min_capital !== undefined ? Number(strategy.min_capital) : undefined,
        avgDrawdown: strategy.avg_drawdown !== undefined ? Number(strategy.avg_drawdown) : undefined,
        riskReward: strategy.risk_reward !== undefined ? Number(strategy.risk_reward) : undefined,
        winStreak: strategy.win_streak !== undefined ? Number(strategy.win_streak) : undefined,
        roi: strategy.roi !== undefined ? Number(strategy.roi) : undefined,
        profit: strategy.profit !== undefined ? Number(strategy.profit) : undefined,
        maxDdi: strategy.max_ddi !== undefined ? Number(strategy.max_ddi) : undefined,
        copiers: strategy.copiers !== undefined ? Number(strategy.copiers) : undefined,
        tag: strategy.tag,
        mastersTag: strategy.masters_tag,
        planPrices: typeof strategy.plan_prices === 'string' ? JSON.parse(strategy.plan_prices) : strategy.plan_prices,
        planDetails: typeof strategy.plan_details === 'string' ? JSON.parse(strategy.plan_details) : strategy.plan_details,
        parameters: typeof strategy.parameters === 'string' ? JSON.parse(strategy.parameters || '{}') : (strategy.parameters || {}),
        contentType: strategy.content_type,
        contentUrl: strategy.content_url,
        contentBlob: strategy.content_blob,
        contentMime: strategy.content_mime,
        iconBlob: strategy.icon_blob,
        iconMime: strategy.icon_mime,
        enabled: strategy.enabled !== undefined ? !!strategy.enabled : true,
        masterAccountId: strategy.master_account_id,
        masterAccountPassword: strategy.master_account_password,
        masterAccountServer: strategy.master_account_server,
        masterPlatform: strategy.master_platform,
        created_at: strategy.created_at.toISOString(),
        updated_at: strategy.updated_at.toISOString()
      };
    }
  } catch (error) {
    console.error('Error getting strategy by ID:', error);
  }

  // Fallback to JSON
  try {
    const db: any = readDatabase();
    const strategies: any[] = Array.isArray(db.strategies) ? db.strategies : [];
    const s = strategies.find((s: any) => s.id === id);
    
    if (s) {
      return {
        ...s,
        riskLevel: s.riskLevel ?? s.risk_level ?? 'medium',
        imageUrl: s.imageUrl ?? s.image_url ?? undefined,
        minCapital: s.minCapital ?? s.min_capital,
        avgDrawdown: s.avgDrawdown ?? s.avg_drawdown,
        riskReward: s.riskReward ?? s.risk_reward,
        winStreak: s.winStreak ?? s.win_streak,
        roi: s.roi,
        profit: s.profit,
        maxDdi: s.maxDdi ?? s.max_ddi,
        copiers: s.copiers,
        tag: s.tag,
        planPrices: s.planPrices ?? s.plan_prices,
        planDetails: s.planDetails ?? s.plan_details,
        parameters: typeof s.parameters === 'string' ? JSON.parse(s.parameters || '{}') : (s.parameters || {}),
        contentType: s.contentType ?? s.content_type,
        contentUrl: s.contentUrl ?? s.content_url,
        enabled: s.enabled !== false,
        masterAccountId: s.masterAccountId ?? s.master_account_id,
        masterAccountPassword: s.masterAccountPassword ?? s.master_account_password,
        masterAccountServer: s.masterAccountServer ?? s.master_account_server,
        masterPlatform: s.masterPlatform ?? s.master_platform,
        created_at: s.created_at || new Date().toISOString(),
        updated_at: s.updated_at || new Date().toISOString()
      };
    }
  } catch (jsonError) {
    console.error('JSON fallback getStrategyById failed:', jsonError);
  }
  
  return null;
};

export const isMasterAccountUsed = async (masterAccountId: string, excludeStrategyId?: string): Promise<boolean> => {
  try {
    // MySQL Check
    let query = 'SELECT COUNT(*) as count FROM strategies WHERE master_account_id = ?';
    const params: any[] = [masterAccountId];
    
    if (excludeStrategyId) {
      query += ' AND id != ?';
      params.push(excludeStrategyId);
    }
    
    const [rows] = await pool.execute(query, params);
    const count = (rows as any)[0].count;
    if (count > 0) return true;
    
  } catch (error) {
    // JSON Fallback
    try {
      const db: any = readDatabase();
      const strategies: any[] = Array.isArray(db.strategies) ? db.strategies : [];
      const exists = strategies.some((s: any) => 
        (s.masterAccountId === masterAccountId || s.master_account_id === masterAccountId) && 
        (!excludeStrategyId || s.id !== excludeStrategyId)
      );
      if (exists) return true;
    } catch (jsonError) {
      console.error('JSON fallback isMasterAccountUsed check failed:', jsonError);
    }
  }
  return false;
};

export const createStrategy = async (
  strategy: Omit<Strategy, 'id' | 'created_at' | 'updated_at'> & { 
    contentType?: string, 
    contentUrl?: string, 
    contentBlob?: Buffer, 
    contentMime?: string, 
    enabled?: boolean,
    iconBlob?: Buffer | null,
    iconMime?: string | null
  }
): Promise<{ success: boolean; strategy?: Strategy; error?: string }> => {
  try {
    if (strategy.masterAccountId) {
      const isUsed = await isMasterAccountUsed(strategy.masterAccountId);
      if (isUsed) {
        return { success: false, error: 'Master account is already assigned to another strategy' };
      }
    }

    const id = `strategy_${Date.now()}`;
    await pool.execute(
      `INSERT INTO strategies (id, name, description, performance, risk_level, category, image_url, roi, profit, max_ddi, copiers, risk_score, tag, masters_tag, plan_prices, plan_details, details, parameters, content_type, content_url, content_blob, content_mime, icon_blob, icon_mime, enabled, master_account_id, master_account_password, master_account_server, master_platform) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        strategy.name,
        strategy.description,
        strategy.performance,
        strategy.riskLevel,
        strategy.category,
        strategy.imageUrl,
        strategy.roi ?? null,
        strategy.profit ?? null,
        strategy.maxDdi ?? null,
        strategy.copiers ?? null,
        strategy.riskScore ?? null,
        strategy.tag ?? null,
        strategy.mastersTag ?? null,
        strategy.planPrices ? JSON.stringify(strategy.planPrices) : null,
        strategy.planDetails ? JSON.stringify(strategy.planDetails) : null,
        strategy.details,
        JSON.stringify(strategy.parameters || {}),
        strategy.contentType || null,
        strategy.contentUrl || null,
        strategy.contentBlob || null,
        strategy.contentMime || null,
        strategy.iconBlob || null,
        strategy.iconMime || null,
        strategy.enabled !== false,
        strategy.masterAccountId || null,
        strategy.masterAccountPassword || null,
        strategy.masterAccountServer || null,
        strategy.masterPlatform || null
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
        roi: strategy.roi,
        profit: strategy.profit,
        maxDdi: strategy.maxDdi,
        copiers: strategy.copiers,
        riskScore: strategy.riskScore,
        tag: strategy.tag,
        mastersTag: strategy.mastersTag,
        planPrices: strategy.planPrices,
        planDetails: strategy.planDetails,
        details: strategy.details ?? '',
      parameters: strategy.parameters || {},
      contentType: strategy.contentType,
      contentUrl: strategy.contentUrl,
      contentBlob: strategy.contentBlob,
      contentMime: strategy.contentMime,
      enabled: strategy.enabled !== false,
      masterAccountId: strategy.masterAccountId,
      masterAccountPassword: strategy.masterAccountPassword,
      masterAccountServer: strategy.masterAccountServer,
      masterPlatform: strategy.masterPlatform,
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
    // Normalize empty-string master fields to nulls and avoid false uniqueness hits
    if (updates.masterAccountId !== undefined && updates.masterAccountId === '') updates.masterAccountId = null as any;
    if (updates.masterAccountPassword !== undefined && updates.masterAccountPassword === '') updates.masterAccountPassword = null as any;
    if (updates.masterAccountServer !== undefined && updates.masterAccountServer === '') updates.masterAccountServer = null as any;

    // Only enforce uniqueness if changing the master to a different non-null value
    if (updates.masterAccountId !== undefined && updates.masterAccountId !== null) {
      const existing = await getStrategyById(id);
      const existingMaster = existing?.masterAccountId || null;
      const nextMaster = updates.masterAccountId;
      if (nextMaster && nextMaster !== existingMaster) {
        const isUsed = await isMasterAccountUsed(nextMaster, id);
        if (isUsed) {
          return { success: false, error: 'Master account is already assigned to another strategy' };
        }
      }
    }

    const setClause: string[] = [];
    const values: any[] = [];

    if (updates.name) { setClause.push('name = ?'); values.push(updates.name); }
    if (updates.description) { setClause.push('description = ?'); values.push(updates.description); }
    if (updates.performance !== undefined) { setClause.push('performance = ?'); values.push(updates.performance); }
    if (updates.riskLevel) { setClause.push('risk_level = ?'); values.push(updates.riskLevel); }
    if (updates.category) { setClause.push('category = ?'); values.push(updates.category); }
    if (updates.imageUrl !== undefined) { setClause.push('image_url = ?'); values.push(updates.imageUrl); }
    if (updates.roi !== undefined) { setClause.push('roi = ?'); values.push(updates.roi); }
    if (updates.profit !== undefined) { setClause.push('profit = ?'); values.push(updates.profit); }
    if (updates.maxDdi !== undefined) { setClause.push('max_ddi = ?'); values.push(updates.maxDdi); }
    if (updates.copiers !== undefined) { setClause.push('copiers = ?'); values.push(updates.copiers); }
    if (updates.riskScore !== undefined) { setClause.push('risk_score = ?'); values.push(updates.riskScore); }
    if (updates.tag !== undefined) { setClause.push('tag = ?'); values.push(updates.tag); }
    if (updates.mastersTag !== undefined) { setClause.push('masters_tag = ?'); values.push(updates.mastersTag); }
    if (updates.planPrices !== undefined) { setClause.push('plan_prices = ?'); values.push(JSON.stringify(updates.planPrices)); }
    if (updates.planDetails !== undefined) { setClause.push('plan_details = ?'); values.push(JSON.stringify(updates.planDetails)); }
    if (updates.details) { setClause.push('details = ?'); values.push(updates.details); }
    if (updates.parameters) { setClause.push('parameters = ?'); values.push(JSON.stringify(updates.parameters)); }
    if (updates.contentType) { setClause.push('content_type = ?'); values.push(updates.contentType); }
    if (updates.contentUrl) { setClause.push('content_url = ?'); values.push(updates.contentUrl); }
    if (updates.contentBlob !== undefined) { setClause.push('content_blob = ?'); values.push(updates.contentBlob ?? null); }
    if (updates.contentMime !== undefined) { setClause.push('content_mime = ?'); values.push(updates.contentMime ?? null); }
    if (updates.iconBlob !== undefined) { setClause.push('icon_blob = ?'); values.push(updates.iconBlob ?? null); }
    if (updates.iconMime !== undefined) { setClause.push('icon_mime = ?'); values.push(updates.iconMime ?? null); }
    if (updates.enabled !== undefined) { setClause.push('enabled = ?'); values.push(updates.enabled); }
    if (updates.masterAccountId !== undefined) { setClause.push('master_account_id = ?'); values.push(updates.masterAccountId ?? null); }
    if (updates.masterAccountPassword !== undefined) { setClause.push('master_account_password = ?'); values.push(updates.masterAccountPassword ?? null); }
    if (updates.masterAccountServer !== undefined) { setClause.push('master_account_server = ?'); values.push(updates.masterAccountServer ?? null); }
    if (updates.masterPlatform !== undefined) { setClause.push('master_platform = ?'); values.push(updates.masterPlatform); }

    if (setClause.length === 0) {
      const existing = await getStrategyById(id);
      return existing ? { success: true, strategy: existing } : { success: false, error: 'Strategy not found' };
    }

    values.push(id);
    const [result] = await pool.execute(`UPDATE strategies SET ${setClause.join(', ')} WHERE id = ?`, values);
    const affectedRows = (result as any).affectedRows;

    if (affectedRows === 0) {
      throw new Error('Strategy not found in MySQL (affectedRows=0)');
    }

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
        roi: updates.roi ?? (existing.roi ?? existing.roi),
        profit: updates.profit ?? (existing.profit ?? existing.profit),
        maxDdi: updates.maxDdi ?? (existing.maxDdi ?? existing.max_ddi),
        copiers: updates.copiers ?? (existing.copiers ?? existing.copiers),
        tag: updates.tag ?? existing.tag,
        mastersTag: updates.mastersTag ?? (existing.mastersTag ?? existing.masters_tag),
        planPrices: updates.planPrices ?? (existing.planPrices ?? existing.plan_prices),
        planDetails: updates.planDetails ?? (existing.planDetails ?? existing.plan_details),
        details: updates.details ?? existing.details,
        parameters: updates.parameters ?? (typeof existing.parameters === 'string' ? JSON.parse(existing.parameters || '{}') : existing.parameters || {}),
        contentType: updates.contentType ?? existing.contentType,
        contentUrl: updates.contentUrl ?? existing.contentUrl,
        contentBlob: updates.contentBlob ?? existing.contentBlob,
        contentMime: updates.contentMime ?? existing.contentMime,
        iconBlob: updates.iconBlob ?? existing.iconBlob,
        iconMime: updates.iconMime ?? existing.iconMime,
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
    const [result] = await pool.execute('DELETE FROM strategies WHERE id = ?', [id]);
    const affectedRows = (result as any).affectedRows;
    
    if (affectedRows === 0) {
      throw new Error('Strategy not found in MySQL (affectedRows=0)');
    }
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
  country_code?: string;
  country?: string;
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
      `INSERT INTO users (id, name, email, password, role, email_verified, wallet_balance, country_code, country) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, 
        userData.name, 
        userData.email, 
        hashedPassword, 
        'USER', 
        false, 
        0, 
        userData.country_code || null, 
        userData.country || null
      ]
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
  // Helper function to validate password (handles both plain text and bcrypt hashes)
  const validatePassword = async (storedPassword: string, providedPassword: string): Promise<boolean> => {
    try {
      if (!storedPassword || !providedPassword) return false;
      
      // Check if password is a bcrypt hash (starts with $2a$, $2b$, or $2y$)
      if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
        return await bcrypt.compare(providedPassword, storedPassword);
      }
      // Fallback to plain text comparison for legacy users
      return storedPassword === providedPassword;
    } catch (error) {
      console.error('Error validating password:', error);
      return false;
    }
  };

  // First, attempt MySQL-based login
  try {
    // Use case-insensitive email comparison
    const [rows] = await pool.execute('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    const users = rows as any[];

    if (users.length > 0) {
      const user = users[0];
      // If user is disabled, block login
      if (typeof user.enabled !== 'undefined' && user.enabled === false) {
        return { success: false, error: 'Account disabled' };
      }
      const isValidPassword = await validatePassword(user.password, password);

      if (!isValidPassword) {
        console.error('Password validation failed for user:', email);
        return { success: false, error: 'Invalid password' };
      }

      // Try to get user with history, but don't fail login if history fetch fails
      try {
        const userWithHistory = await getUserById(user.id);
        if (userWithHistory) {
          return { success: true, user: userWithHistory };
        }
      } catch (historyErr) {
        console.warn('Failed to fetch user history during login, returning base user:', historyErr);
      }
      
      // If we are here, we have a valid password but couldn't get history or getUserById returned null
      // Return the base user from the first query
      return { success: true, user: user as User };
    }
  } catch (error) {
    console.error('An error occurred during MySQL login:', error);
  }

  // Fallback to JSON database if MySQL fails or user not found
  try {
    console.log(`Attempting JSON fallback for user: ${email}`);
    const db: any = readDatabase();
    const user = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());

    if (user) {
      if (typeof user.enabled !== 'undefined' && user.enabled === false) {
        return { success: false, error: 'Account disabled' };
      }
      const isValidPassword = await validatePassword(user.password, password);
      if (isValidPassword) {
        return { success: true, user: user as User };
      }
    }
  } catch (jsonError) {
    console.error('JSON fallback login failed:', jsonError);
  }

  return { success: false, error: 'Invalid credentials' };
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
      updated_at: user.updated_at.toISOString(),
      password_updated_at: user.password_updated_at ? (typeof user.password_updated_at === 'string' ? user.password_updated_at : user.password_updated_at.toISOString()) : undefined,
      email_updated_at: user.email_updated_at ? (typeof user.email_updated_at === 'string' ? user.email_updated_at : user.email_updated_at.toISOString()) : undefined,
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

export const getTransactionsByUser = async (userId: string): Promise<WalletTransaction[]> => {
  try {
    const [rows] = await pool.execute('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC', [userId]);

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
    console.error('MySQL getTransactionsByUser failed, falling back to JSON:', error);
    try {
      const db: any = readDatabase();
      const arr: any[] = Array.isArray(db.wallet_transactions) ? db.wallet_transactions.filter((t: any) => t.user_id === userId) : [];
      return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (jsonError) {
      console.error('JSON fallback getTransactionsByUser failed:', jsonError);
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
    
    // If approved, update user's wallet balance
    if (status === 'completed') {
      // Use tokensToAdd if provided (legacy), otherwise use transaction amount
      const amountToAdd = tokensToAdd && tokensToAdd > 0 ? tokensToAdd : (transaction.amount || 0);
      
      if (amountToAdd > 0) {
        await pool.execute(
          'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
          [amountToAdd, transaction.user_id]
        );
        const user = await getUserById(transaction.user_id);
        updatedUser = user as any;
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
      if (status === 'completed') {
        const users: any[] = Array.isArray(db.users) ? db.users : [];
        const uIdx = users.findIndex(u => u.id === txs[idx].user_id);
        if (uIdx !== -1) {
          const amountToAdd = tokensToAdd && tokensToAdd > 0 ? tokensToAdd : (txs[idx].amount || 0);
          users[uIdx].wallet_balance = (users[uIdx].wallet_balance || 0) + amountToAdd;
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
  updates: { name?: string; email?: string; password?: string; role?: 'USER' | 'ADMIN'; enabled?: boolean; password_updated_at?: Date | string; email_updated_at?: Date | string; phone?: string }
): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    const fields: string[] = [];
    const values: any[] = [];

    if (typeof updates.name !== 'undefined') { fields.push('name = ?'); values.push(updates.name); }
    if (typeof updates.email !== 'undefined') { fields.push('email = ?'); values.push(updates.email); }
    if (typeof updates.password !== 'undefined') { fields.push('password = ?'); values.push(await hashPassword(updates.password)); }
    if (typeof updates.role !== 'undefined') { fields.push('role = ?'); values.push(updates.role); }
    if (typeof updates.enabled !== 'undefined') { fields.push('enabled = ?'); values.push(!!updates.enabled); }
    if (typeof updates.password_updated_at !== 'undefined') { fields.push('password_updated_at = ?'); values.push(updates.password_updated_at); }
    if (typeof updates.email_updated_at !== 'undefined') { fields.push('email_updated_at = ?'); values.push(updates.email_updated_at); }
    if (typeof updates.phone !== 'undefined') { fields.push('phone = ?'); values.push(updates.phone); }

    if (fields.length === 0) {
      return { success: false, error: 'No fields to update' };
    }

    values.push(id);
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    await pool.execute(sql, values);

    const user = await getUserById(id);
    return { success: true, user: user! };
  } catch (error) {
    console.error('updateUserAdmin failed:', error);
    return { success: false, error: 'Failed to update user' };
  }
};

export const deleteUserAdmin = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    if ((result as any).affectedRows === 0) {
      throw new Error('User not found in MySQL');
    }
    return { success: true };
  } catch (error) {
    console.error('MySQL deleteUserAdmin failed, falling back to JSON:', error);
    try {
      const db: any = readDatabase();
      const arr: any[] = Array.isArray(db.users) ? db.users : [];
      const filtered = arr.filter((u: any) => u.id !== id);
      if (filtered.length === arr.length) {
        return { success: false, error: 'User not found' };
      }
      db.users = filtered;
      writeDatabase(db);
      return { success: true };
    } catch (jsonError) {
      console.error('JSON fallback deleteUserAdmin failed:', jsonError);
      return { success: false, error: 'Failed to delete user locally' };
    }
  }
};

// Running Strategies operations
export const getRunningStrategiesForUser = async (userId: string): Promise<any[]> => {
  try {
    // Get running strategies from running_strategies table
    const [runningRows] = await pool.execute(
      'SELECT * FROM running_strategies WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    
    // Also get completed wallet transactions that have strategy_id
    const [transactionRows] = await pool.execute(
      'SELECT * FROM wallet_transactions WHERE user_id = ? AND status = "completed" AND strategy_id IS NOT NULL ORDER BY updated_at DESC',
      [userId]
    );
    
    // Combine and deduplicate results
    const allStrategies = new Map();
    
    // Add running strategies
    (runningRows as any[]).forEach(row => {
      allStrategies.set(row.strategy_id, {
        id: row.id,
        strategyId: row.strategy_id,
        userId: row.user_id,
        plan: row.plan,
        capital: parseFloat(row.capital) || 0,
        status: row.status,
        adminStatus: row.admin_status,
        platform: row.platform,
        mtAccountId: row.mt_account_id,
        mtAccountPassword: row.mt_account_password,
        mtAccountServer: row.mt_account_server,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        source: 'running_strategies'
      });
    });
    
    // Add completed transactions that aren't already in running_strategies
    (transactionRows as any[]).forEach(row => {
      if (!allStrategies.has(row.strategy_id)) {
        allStrategies.set(row.strategy_id, {
          id: `txn_${row.id}`,
          strategyId: row.strategy_id,
          userId: row.user_id,
          plan: row.plan_level,
          capital: parseFloat(row.amount) || 0,
          status: 'completed',
          adminStatus: 'running',
          platform: row.platform,
          mtAccountId: row.mt_account_id,
          mtAccountPassword: row.mt_account_password,
          mtAccountServer: row.mt_account_server,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at?.toISOString() || row.created_at.toISOString(),
          source: 'wallet_transaction'
        });
      }
    });
    
    return Array.from(allStrategies.values());
  } catch (error) {
    console.error('Error getting running strategies for user:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const runningStrategies: any[] = Array.isArray(db.running_strategies) ? db.running_strategies : [];
      const walletTransactions: any[] = Array.isArray(db.wallet_transactions) ? db.wallet_transactions : [];
      
      // Filter running strategies for this user
      const userRunningStrategies = runningStrategies.filter((r: any) => r.user_id === userId);
      
      // Filter completed transactions for this user
      const completedTransactions = walletTransactions.filter((t: any) => 
        t.user_id === userId && 
        t.status === 'completed' && 
        t.strategy_id
      );
      
      // Combine and deduplicate
      const allStrategies = new Map();
      
      userRunningStrategies.forEach((r: any) => {
        allStrategies.set(r.strategy_id, { ...r, source: 'running_strategies' });
      });
      
      completedTransactions.forEach((t: any) => {
        if (!allStrategies.has(t.strategy_id)) {
          allStrategies.set(t.strategy_id, {
            id: `txn_${t.id}`,
            strategyId: t.strategy_id,
            userId: t.user_id,
            plan: t.plan_level,
            capital: t.amount || 0,
            status: 'completed',
            adminStatus: 'running',
            platform: t.platform,
            mtAccountId: t.mt_account_id,
            mtAccountPassword: t.mt_account_password,
            mtAccountServer: t.mt_account_server,
            createdAt: t.created_at,
            updatedAt: t.updated_at || t.created_at,
            source: 'wallet_transaction'
          });
        }
      });
      
      return Array.from(allStrategies.values());
    } catch (jsonError) {
      console.error('JSON fallback getRunningStrategiesForUser failed:', jsonError);
      return [];
    }
  }
};

export const createRunningStrategy = async (
  userId: string,
  strategyId: string,
  plan: string,
  capital: number,
  mtDetails?: {
    platform?: string;
    mtAccountId?: string;
    mtAccountPassword?: string;
    mtAccountServer?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> => {
  const id = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    await pool.execute(
      `INSERT INTO running_strategies (id, user_id, strategy_id, plan, capital, status, platform, mt_account_id, mt_account_password, mt_account_server)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        strategyId,
        plan,
        capital,
        'in-process',
        mtDetails?.platform || null,
        mtDetails?.mtAccountId || null,
        mtDetails?.mtAccountPassword || null,
        mtDetails?.mtAccountServer || null
      ]
    );
    
    return { success: true, id };
  } catch (error) {
    console.error('Error creating running strategy:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const runningStrategies: any[] = Array.isArray(db.running_strategies) ? db.running_strategies : [];
      
      const newStrategy = {
        id: id,
        user_id: userId,
        strategy_id: strategyId,
        plan,
        capital,
        status: 'in-process',
        platform: mtDetails?.platform || null,
        mt_account_id: mtDetails?.mtAccountId || null,
        mt_account_password: mtDetails?.mtAccountPassword || null,
        mt_account_server: mtDetails?.mtAccountServer || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      runningStrategies.push(newStrategy);
      writeDatabase({ ...db, running_strategies: runningStrategies });
      
      return { success: true, id };
    } catch (jsonError) {
      console.error('JSON fallback createRunningStrategy failed:', jsonError);
      return { success: false, error: 'Failed to create running strategy' };
    }
  }
};

export const getRunningStrategyById = async (id: string): Promise<any | null> => {
  try {
    const [rows] = await pool.execute('SELECT * FROM running_strategies WHERE id = ?', [id]);
    const strategies = rows as any[];
    
    if (strategies.length > 0) {
      const strategy = strategies[0];
      return {
        ...strategy,
        created_at: strategy.created_at.toISOString(),
        updated_at: strategy.updated_at.toISOString()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting running strategy by ID:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const runningStrategies: any[] = Array.isArray(db.running_strategies) ? db.running_strategies : [];
      return runningStrategies.find((r: any) => r.id === id) || null;
    } catch (jsonError) {
      console.error('JSON fallback getRunningStrategyById failed:', jsonError);
      return null;
    }
  }
};

export const updateRunningStrategyAdminStatus = async (id: string, status: string): Promise<boolean> => {
  try {
    await pool.execute(
      'UPDATE running_strategies SET admin_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );
    return true;
  } catch (error) {
    console.error('Error updating running strategy admin status:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const runningStrategies: any[] = Array.isArray(db.running_strategies) ? db.running_strategies : [];
      const index = runningStrategies.findIndex((r: any) => r.id === id);
      
      if (index !== -1) {
        runningStrategies[index].admin_status = status;
        runningStrategies[index].updated_at = new Date().toISOString();
        writeDatabase({ ...db, running_strategies: runningStrategies });
        return true;
      }
      return false;
    } catch (jsonError) {
      console.error('JSON fallback updateRunningStrategyAdminStatus failed:', jsonError);
      return false;
    }
  }
};

export const deleteRunningStrategyForUserStrategy = async (userId: string, strategyId: string): Promise<boolean> => {
  try {
    await pool.execute(
      'DELETE FROM running_strategies WHERE user_id = ? AND strategy_id = ?',
      [userId, strategyId]
    );
    return true;
  } catch (error) {
    console.error('Error deleting running strategy for user/strategy:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const runningStrategies: any[] = Array.isArray(db.running_strategies) ? db.running_strategies : [];
      const filtered = runningStrategies.filter((r: any) => !(r.user_id === userId && r.strategy_id === strategyId));
      
      if (filtered.length < runningStrategies.length) {
        db.running_strategies = filtered;
        writeDatabase(db);
        return true;
      }
      return false;
    } catch (jsonError) {
      console.error('JSON fallback deleteRunningStrategyForUserStrategy failed:', jsonError);
      return false;
    }
  }
};

export const updateRunningStrategyMtDetails = async (
  id: string,
  updates: { platform?: 'MT4' | 'MT5'; mt_account_id?: string; mt_account_password?: string; mt_account_server?: string }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.platform) { fields.push('platform = ?'); values.push(updates.platform); }
    if (updates.mt_account_id) { fields.push('mt_account_id = ?'); values.push(updates.mt_account_id); }
    if (updates.mt_account_password) { fields.push('mt_account_password = ?'); values.push(updates.mt_account_password); }
    if (updates.mt_account_server) { fields.push('mt_account_server = ?'); values.push(updates.mt_account_server); }

    if (fields.length === 0) return { success: true };

    values.push(id);
    await pool.execute(
      `UPDATE running_strategies SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    return { success: true };
  } catch (error) {
    console.error('Error updating running strategy MT details:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const runningStrategies: any[] = Array.isArray(db.running_strategies) ? db.running_strategies : [];
      const index = runningStrategies.findIndex((r: any) => r.id === id);
      
      if (index !== -1) {
        if (updates.platform) runningStrategies[index].platform = updates.platform;
        if (updates.mt_account_id) runningStrategies[index].mt_account_id = updates.mt_account_id;
        if (updates.mt_account_password) runningStrategies[index].mt_account_password = updates.mt_account_password;
        if (updates.mt_account_server) runningStrategies[index].mt_account_server = updates.mt_account_server;
        runningStrategies[index].updated_at = new Date().toISOString();
        writeDatabase({ ...db, running_strategies: runningStrategies });
        return { success: true };
      }
      return { success: false, error: 'Not found' };
    } catch (jsonError) {
      return { success: false, error: 'JSON fallback failed' };
    }
  }
};

export const getRunningStrategyModificationById = async (id: string): Promise<any | null> => {
  try {
    const [rows] = await pool.execute('SELECT * FROM running_strategy_modifications WHERE id = ?', [id]);
    const mods = rows as any[];
    return mods.length > 0 ? mods[0] : null;
  } catch (error) {
    console.error('Error getting running strategy modification by ID:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const modifications: any[] = Array.isArray(db.running_strategy_modifications) ? db.running_strategy_modifications : [];
      return modifications.find((m: any) => m.id === id) || null;
    } catch (jsonError) {
      return null;
    }
  }
};

export const getPendingModificationsForStrategy = async (runningStrategyId: string): Promise<any[]> => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM running_strategy_modifications WHERE running_strategy_id = ? AND status = "in-process" ORDER BY created_at ASC',
      [runningStrategyId]
    );
    return rows as any[];
  } catch (error) {
    console.error('Error getting pending modifications for strategy:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const modifications: any[] = Array.isArray(db.running_strategy_modifications) ? db.running_strategy_modifications : [];
      return modifications.filter((m: any) => m.running_strategy_id === runningStrategyId && m.status === 'in-process');
    } catch (jsonError) {
      return [];
    }
  }
};

export const deleteRunningStrategyModification = async (id: string): Promise<boolean> => {
  try {
    await pool.execute('DELETE FROM running_strategy_modifications WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('Error deleting running strategy modification:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const modifications: any[] = Array.isArray(db.running_strategy_modifications) ? db.running_strategy_modifications : [];
      const filtered = modifications.filter((m: any) => m.id !== id);
      if (filtered.length < modifications.length) {
        db.running_strategy_modifications = filtered;
        writeDatabase(db);
        return true;
      }
      return false;
    } catch (jsonError) {
      return false;
    }
  }
};

export const countRunningStrategyModificationsForRun = async (runningStrategyId: string): Promise<number> => {
  try {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM running_strategy_modifications WHERE running_strategy_id = ? AND status = "in-process"',
      [runningStrategyId]
    );
    return (rows as any[])[0].count;
  } catch (error) {
    console.error('Error counting running strategy modifications:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const modifications: any[] = Array.isArray(db.running_strategy_modifications) ? db.running_strategy_modifications : [];
      return modifications.filter((m: any) => m.running_strategy_id === runningStrategyId && m.status === 'in-process').length;
    } catch (jsonError) {
      return 0;
    }
  }
};

export const getRunningStrategyModificationsAdmin = async (): Promise<any[]> => {
  try {
    const [rows] = await pool.execute(`
      SELECT m.*, u.name as userName, u.email as userEmail, s.name as strategyName
      FROM running_strategy_modifications m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN running_strategies rs ON m.running_strategy_id = rs.id
      LEFT JOIN strategies s ON rs.strategy_id = s.id
      ORDER BY m.created_at DESC
    `);
    return (rows as any[]).map(row => ({
      ...row,
      created_at: row.created_at.toISOString()
    }));
  } catch (error) {
    console.error('Error getting admin running strategy modifications:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const modifications: any[] = Array.isArray(db.running_strategy_modifications) ? db.running_strategy_modifications : [];
      const users: any[] = Array.isArray(db.users) ? db.users : [];
      const runningStrategies: any[] = Array.isArray(db.running_strategies) ? db.running_strategies : [];
      const strategies: any[] = Array.isArray(db.strategies) ? db.strategies : [];

      return modifications.map(m => {
        const user = users.find(u => u.id === m.user_id);
        const rs = runningStrategies.find(r => r.id === m.running_strategy_id);
        const strategy = rs ? strategies.find(s => s.id === rs.strategy_id) : null;
        return {
          ...m,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || '',
          strategyName: strategy?.name || 'Unknown'
        };
      });
    } catch (jsonError) {
      return [];
    }
  }
};

export const setTransactionAdminMessage = async (
  transactionId: string,
  adminId: string,
  message: string,
  messageStatus: 'pending' | 'sent' | 'read' = 'pending'
): Promise<WalletTransaction | null> => {
  try {
    await pool.execute(
      'UPDATE wallet_transactions SET admin_message = ?, admin_message_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [message, messageStatus, transactionId]
    );
    return await getTransactionById(transactionId);
  } catch (error) {
    console.error('Error setting transaction admin message:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const txs: any[] = Array.isArray(db.wallet_transactions) ? db.wallet_transactions : [];
      const idx = txs.findIndex(t => t.id === transactionId);
      if (idx !== -1) {
        txs[idx].admin_message = message;
        txs[idx].admin_message_status = messageStatus;
        txs[idx].updated_at = new Date().toISOString();
        writeDatabase({ ...db, wallet_transactions: txs });
        return txs[idx];
      }
      return null;
    } catch (jsonError) {
      return null;
    }
  }
};

export const createRunningStrategyModification = async (payload: any): Promise<boolean> => {
  try {
    await pool.execute(
      `INSERT INTO running_strategy_modifications
        (id, running_strategy_id, user_id, platform, mt_account_id, mt_account_password, mt_account_server, status, new_update_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.id,
        payload.running_strategy_id,
        payload.user_id,
        payload.platform || null,
        payload.mt_account_id || null,
        payload.mt_account_password || null,
        payload.mt_account_server || null,
        payload.status || 'in-process',
        payload.new_update_json ? JSON.stringify(payload.new_update_json) : null
      ]
    );
    return true;
  } catch (error) {
    console.error('Error creating running strategy modification:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const modifications: any[] = Array.isArray(db.running_strategy_modifications) ? db.running_strategy_modifications : [];
      const newEntry = {
        id: payload.id,
        running_strategy_id: payload.running_strategy_id,
        user_id: payload.user_id,
        platform: payload.platform || null,
        mt_account_id: payload.mt_account_id || null,
        mt_account_password: payload.mt_account_password || null,
        mt_account_server: payload.mt_account_server || null,
        status: payload.status || 'in-process',
        new_update_json: payload.new_update_json || null,
        created_at: new Date().toISOString()
      };
      modifications.push(newEntry);
      writeDatabase({ ...db, running_strategy_modifications: modifications });
      return true;
    } catch (jsonError) {
      console.error('JSON fallback createRunningStrategyModification failed:', jsonError);
      return false;
    }
  }
};

export const createDisconnectSnapshot = async (snapshot: any): Promise<boolean> => {
  try {
    await pool.execute(
      `INSERT INTO disconnect_snapshots (id, running_strategy_id, snapshot_data)
       VALUES (?, ?, ?)`,
      [
        snapshot.id,
        snapshot.running_strategy_id,
        JSON.stringify(snapshot)
      ]
    );
    return true;
  } catch (error) {
    // If table not found, create it and retry once
    if (error && typeof error === 'object' && 'code' in error && (error as any).code === 'ER_NO_SUCH_TABLE') {
      try {
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS disconnect_snapshots (
            id VARCHAR(255) PRIMARY KEY,
            running_strategy_id VARCHAR(255) NOT NULL,
            snapshot_data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        try {
          await pool.execute(`
            ALTER TABLE disconnect_snapshots 
            ADD CONSTRAINT fk_disconnect_snapshots_running_strategy 
            FOREIGN KEY (running_strategy_id) REFERENCES running_strategies(id) ON DELETE CASCADE
          `);
        } catch (fkError) {
          console.warn('Could not add foreign key constraint for disconnect_snapshots:', fkError);
        }
      } catch (createError) {
        console.error('Failed to create disconnect_snapshots table:', createError);
        return false;
      }

      try {
        await pool.execute(
          `INSERT INTO disconnect_snapshots (id, running_strategy_id, snapshot_data)
           VALUES (?, ?, ?)`,
          [snapshot.id, snapshot.running_strategy_id, JSON.stringify(snapshot)]
        );
        return true;
      } catch (retryError) {
        console.error('Retry insert disconnect snapshot failed:', retryError);
        return false;
      }
    }

    console.error('Error creating disconnect snapshot:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const snapshots: any[] = Array.isArray(db.disconnect_snapshots) ? db.disconnect_snapshots : [];
      snapshots.push({
        id: snapshot.id,
        running_strategy_id: snapshot.running_strategy_id,
        snapshot_data: snapshot,
        created_at: new Date().toISOString()
      });
      writeDatabase({ ...db, disconnect_snapshots: snapshots });
      return true;
    } catch (jsonError) {
      console.error('JSON fallback createDisconnectSnapshot failed:', jsonError);
      return false;
    }
  }
};

export const getRunningStrategyModifications = async (runningStrategyId: string): Promise<any[]> => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM running_strategy_modifications WHERE running_strategy_id = ? ORDER BY created_at DESC',
      [runningStrategyId]
    );
    return (rows as any[]).map(row => ({
      ...row,
      created_at: row.created_at.toISOString()
    }));
  } catch (error) {
    console.error('Error getting running strategy modifications:', error);
    return [];
  }
};

export const getDisconnectSnapshots = async (runningStrategyId: string): Promise<any[]> => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM disconnect_snapshots WHERE running_strategy_id = ? ORDER BY created_at DESC',
      [runningStrategyId]
    );
    return (rows as any[]).map(row => ({
      ...row,
      created_at: row.created_at.toISOString()
    }));
  } catch (error) {
    // Check if it's a table doesn't exist error
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_NO_SUCH_TABLE') {
      console.warn('disconnect_snapshots table does not exist, creating it...');
      try {
        // Create the table
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS disconnect_snapshots (
            id VARCHAR(255) PRIMARY KEY,
            running_strategy_id VARCHAR(255) NOT NULL,
            snapshot_data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Try adding foreign key constraint separately
        try {
          await pool.execute(`
            ALTER TABLE disconnect_snapshots 
            ADD CONSTRAINT fk_disconnect_snapshots_running_strategy 
            FOREIGN KEY (running_strategy_id) REFERENCES running_strategies(id) ON DELETE CASCADE
          `);
        } catch (fkError) {
          console.warn('Could not add foreign key constraint for disconnect_snapshots:', fkError);
        }
        
        // Return empty array since table was just created
        return [];
      } catch (createError) {
        console.error('Failed to create disconnect_snapshots table:', createError);
      }
    }
    
    console.error('Error getting disconnect snapshots:', error);
    return [];
  }
};

export const updateWalletTransactionStatus = async (
  mtAccountId: string,
  status: string,
  rejectionReason?: string
): Promise<boolean> => {
  try {
    const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [status];
    
    if (rejectionReason) {
      updates.push('rejection_reason = ?');
      values.push(rejectionReason);
    }
    
    values.push(mtAccountId);
    
    await pool.execute(
      `UPDATE wallet_transactions SET ${updates.join(', ')} WHERE mt_account_id = ?`,
      values
    );
    return true;
  } catch (error) {
    console.error('Error updating wallet transaction status:', error);
    return false;
  }
};

export const getRunningStrategiesAdmin = async (): Promise<any[]> => {
  try {
    const [rows] = await pool.execute(`
      SELECT rs.*, u.name as userName, u.email as userEmail, s.name as strategyName 
      FROM running_strategies rs
      LEFT JOIN users u ON rs.user_id = u.id
      LEFT JOIN strategies s ON rs.strategy_id = s.id
      ORDER BY rs.created_at DESC
    `);
    
    return (rows as any[]).map(row => ({
      id: row.id,
      userId: row.user_id,
      userName: row.userName || 'Unknown',
      userEmail: row.userEmail || '',
      strategyId: row.strategy_id,
      strategyName: row.strategyName || 'Unknown',
      plan: row.plan,
      capital: parseFloat(row.capital) || 0,
      status: row.status,
      adminStatus: row.admin_status,
      platform: row.platform,
      mtAccountId: row.mt_account_id,
      mtAccountServer: row.mt_account_server,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  } catch (error) {
    console.error('Error getting admin running strategies:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const runningStrategies: any[] = Array.isArray(db.running_strategies) ? db.running_strategies : [];
      const users: any[] = Array.isArray(db.users) ? db.users : [];
      const strategies: any[] = Array.isArray(db.strategies) ? db.strategies : [];
      
      return runningStrategies.map((rs: any) => {
        const user = users.find((u: any) => u.id === rs.user_id);
        const strategy = strategies.find((s: any) => s.id === rs.strategy_id);
        
        return {
          id: rs.id,
          userId: rs.user_id,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || '',
          strategyId: rs.strategy_id,
          strategyName: strategy?.name || 'Unknown',
          plan: rs.plan,
          capital: rs.capital || 0,
          status: rs.status,
          adminStatus: rs.admin_status,
          platform: rs.platform,
          mtAccountId: rs.mt_account_id,
          mtAccountServer: rs.mt_account_server,
          createdAt: rs.created_at,
          updatedAt: rs.updated_at
        };
      });
    } catch (jsonError) {
      console.error('JSON fallback getRunningStrategiesAdmin failed:', jsonError);
      return [];
    }
  }
};

// Master Trades operations
export const upsertMasterTrades = async (masterId: string, trades: any[], isOpen: boolean): Promise<void> => {
  try {
    // Attempt to ensure table exists (Vercel/production environment check)
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS master_trades_cache (
          id VARCHAR(255) PRIMARY KEY,
          master_id VARCHAR(255) NOT NULL,
          position_id VARCHAR(255) NOT NULL,
          symbol VARCHAR(50) NOT NULL,
          type ENUM('BUY', 'SELL') NOT NULL,
          volume DECIMAL(18,2) NOT NULL,
          price_open DECIMAL(18,5) NOT NULL,
          price_close DECIMAL(18,5),
          profit DECIMAL(18,2) DEFAULT 0,
          commission DECIMAL(18,2) DEFAULT 0,
          swap DECIMAL(18,2) DEFAULT 0,
          time_open TIMESTAMP NOT NULL,
          time_close TIMESTAMP,
          is_open BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_master_id (master_id),
          INDEX idx_position_id (position_id),
          UNIQUE KEY idx_master_pos (master_id, position_id)
        )
      `);
    } catch (tableError: any) {
      console.warn('[DB] master_trades_cache table check/creation failed:', tableError?.message || tableError);
    }
    
    if (isOpen) {
      // For open positions, we replace existing set because open trades change frequently
      await pool.execute('DELETE FROM master_trades_cache WHERE master_id = ? AND is_open = 1', [masterId]);
    }
    
    // Insert new trades
    if (trades.length > 0) {
      const values = trades.map(trade => {
        const positionId = String(trade.position_id || trade.ticket || trade.id);
        if (!positionId || positionId === 'undefined') return null;

        // Use a deterministic ID to prevent duplicates for closed trades
        const uniqueId = `${masterId}_${positionId}`;
        
        return [
          uniqueId,
          masterId,
          positionId,
          trade.symbol || '',
          (trade.type || 'BUY').toString().toUpperCase(),
          trade.volume || 0,
          trade.price_open || 0,
          trade.price_close || trade.price_current || null,
          trade.profit || 0,
          trade.commission || 0,
          trade.swap || 0,
          trade.time_open || trade.time || new Date().toISOString(),
          trade.time_close || null,
          isOpen ? 1 : 0,
          new Date().toISOString()
        ];
      }).filter(v => v !== null);
      
      if (values.length === 0) return;

      const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      
      // Use REPLACE INTO for open trades to update price/profit, and INSERT IGNORE for closed to avoid overwriting
      const verb = isOpen ? 'REPLACE' : 'INSERT IGNORE';
      const sql = `${verb} INTO master_trades_cache (
            id, master_id, position_id, symbol, type, volume, price_open, price_close, 
            profit, commission, swap, time_open, time_close, is_open, created_at
          ) VALUES ${placeholders}`;

      await pool.execute(sql, values.flat());
    }
  } catch (error) {
    console.error('Error upserting master trades:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const masterTrades: any[] = Array.isArray(db.master_trades_cache) ? db.master_trades_cache : [];
      
      // Remove existing trades for this master
      const filteredTrades = masterTrades.filter(t => t.master_id !== masterId);
      
      // Add new trades
      const newTrades = trades.map(trade => {
        const positionId = String(trade.position_id || trade.ticket || trade.id || Math.random().toString(36).substr(2, 9));
        return {
          id: `${masterId}_${positionId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          master_id: masterId,
          position_id: positionId,
          symbol: trade.symbol || '',
          type: (trade.type || 'BUY').toString().toUpperCase(),
          volume: trade.volume || 0,
          price_open: trade.price_open || 0,
          price_close: trade.price_close || null,
          profit: trade.profit || 0,
          commission: trade.commission || 0,
          swap: trade.swap || 0,
          time_open: trade.time_open || new Date().toISOString(),
          time_close: trade.time_close || null,
          is_open: isOpen ? 1 : 0,
          created_at: new Date().toISOString()
        };
      });
      
      writeDatabase({ ...db, master_trades_cache: [...filteredTrades, ...newTrades] });
    } catch (jsonError) {
      console.error('JSON fallback upsertMasterTrades failed:', jsonError);
    }
  }
};

export const getCachedMasterTrades = async (masterId: string): Promise<{ history: any[], open_positions: any[] }> => {
  try {
    // Ensure table exists (especially for Vercel/production)
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS master_trades_cache (
          id VARCHAR(255) PRIMARY KEY,
          master_id VARCHAR(255) NOT NULL,
          position_id VARCHAR(255) NOT NULL,
          symbol VARCHAR(50) NOT NULL,
          type ENUM('BUY', 'SELL') NOT NULL,
          volume DECIMAL(18,2) NOT NULL,
          price_open DECIMAL(18,5) NOT NULL,
          price_close DECIMAL(18,5),
          profit DECIMAL(18,2) DEFAULT 0,
          commission DECIMAL(18,2) DEFAULT 0,
          swap DECIMAL(18,2) DEFAULT 0,
          time_open TIMESTAMP NOT NULL,
          time_close TIMESTAMP,
          is_open BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_master_id (master_id),
          INDEX idx_position_id (position_id),
          INDEX idx_time_open (time_open)
        )
      `);
    } catch (tableError) {
      console.warn('master_trades_cache table creation failed:', tableError);
    }
    
    let rows;
    try {
      [rows] = await pool.execute(
        'SELECT * FROM master_trades_cache WHERE master_id = ? ORDER BY time_open DESC',
        [masterId]
      );
    } catch (selectError) {
      // If table still doesn't exist, return empty result instead of crashing
      if (selectError && typeof selectError === 'object' && 'code' in selectError && selectError.code === 'ER_NO_SUCH_TABLE') {
        console.warn(`master_trades_cache table still doesn't exist for ${masterId}, returning empty result`);
        return { history: [], open_positions: [] };
      }
      throw selectError;
    }
    
    const trades = rows as any[];
    const history = trades.filter(t => t.is_open === 0);
    const open_positions = trades.filter(t => t.is_open === 1);
    
    return {
      history: history.map(t => ({
        position_id: t.position_id,
        symbol: t.symbol,
        type: t.type,
        volume: t.volume,
        price_open: t.price_open,
        price_close: t.price_close,
        profit: t.profit,
        swap: t.swap,
        time_open: t.time_open,
        time_close: t.time_close
      })),
      open_positions: open_positions.map(t => ({
        position_id: t.position_id,
        symbol: t.symbol,
        type: t.type,
        volume: t.volume,
        price_open: t.price_open,
        profit: t.profit,
        time_open: t.time_open
      }))
    };
  } catch (error) {
    console.error('Error getting cached master trades:', error);
    // JSON fallback
    try {
      const db: any = readDatabase();
      const masterTrades: any[] = Array.isArray(db.master_trades_cache) ? db.master_trades_cache : [];
      const filteredTrades = masterTrades.filter(t => t.master_id === masterId);
      
      const history = filteredTrades.filter(t => t.is_open === 0);
      const open_positions = filteredTrades.filter(t => t.is_open === 1);
      
      return {
        history: history.map(t => ({
          position_id: t.position_id,
          symbol: t.symbol,
          type: t.type,
          volume: t.volume,
          price_open: t.price_open,
          price_close: t.price_close,
          profit: t.profit,
          swap: t.swap,
          time_open: t.time_open,
          time_close: t.time_close
        })),
        open_positions: open_positions.map(t => ({
          position_id: t.position_id,
          symbol: t.symbol,
          type: t.type,
          volume: t.volume,
          price_open: t.price_open,
          profit: t.profit,
          time_open: t.time_open
        }))
      };
    } catch (jsonError) {
      console.error('JSON fallback getCachedMasterTrades failed:', jsonError);
      return { history: [], open_positions: [] };
    }
  }
};
