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
    return { users: [] };
  }
  try {
    const path = require('path');
    const fs = require('fs');
    const DB_FILE_PATH = path.join(process.cwd(), 'src', 'db', 'database.json');
    const data = fs.readFileSync(DB_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file:', error);
    // Return default structure if file doesn't exist or is invalid
    return { users: [] };
  }
};

// Write database to JSON file
export const writeDatabase = (data: any) => {
  // Prevent client-side usage; this is server-only.
  if (typeof window !== 'undefined') {
    console.warn('writeDatabase() is server-only and should not run in the browser.');
    return false;
  }
  try {
    const path = require('path');
    const fs = require('fs');
    const DB_FILE_PATH = path.join(process.cwd(), 'src', 'db', 'database.json');
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
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
  transaction_type: 'deposit' | 'charge';
  payment_method?: string;
  transaction_id?: string;
  receipt_path?: string;
  platform?: 'MT4' | 'MT5';
  mt_account_id?: string;
  mt_account_password?: string; // Stored as plain text per requirement
  terms_accepted?: boolean;
  // New optional fields
  inr_amount?: number;
  inr_to_usd_rate?: number;
  crypto_network?: 'ERC20' | 'TRC20';
  crypto_wallet_address?: string;
  wallet_app_deeplink?: string;
  status: 'pending' | 'completed' | 'failed';
  admin_id?: string;
  created_at: string;
  updated_at?: string;
};

export type Strategy = {
  id: string;
  name: string;
  description: string;
  performance: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  category: 'Growth' | 'Income' | 'Momentum' | 'Value';
  imageUrl: string;
  details: string;
  parameters: Record<string, string>;
  contentType?: string;
  contentUrl?: string;
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
        status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
        admin_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN admin_id VARCHAR(255)"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"); } catch (e) {}
    // Add INR/USDT columns for new payment flows
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN inr_amount DECIMAL(12,2)"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN inr_to_usd_rate DECIMAL(12,6)"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN crypto_network ENUM('ERC20','TRC20')"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN crypto_wallet_address VARCHAR(128)"); } catch (e) {}
    try { await pool.execute("ALTER TABLE wallet_transactions ADD COLUMN wallet_app_deeplink VARCHAR(255)"); } catch (e) {}

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
    const [userRows] = await pool.execute('SELECT id FROM users WHERE email = ?', ['user@example.com']);
    
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
initializeDatabase();

// Strategy CRUD operations
export const getAllStrategies = async (): Promise<Strategy[]> => {
  try {
    const [rows] = await pool.execute('SELECT * FROM strategies ORDER BY created_at DESC');
    return (rows as any[]).map(row => ({
      ...row,
      riskLevel: row.risk_level,
      imageUrl: row.image_url,
      parameters: JSON.parse(row.parameters || '{}'),
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString()
    }));
  } catch (error) {
    console.error('Error getting strategies:', error);
    return [];
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
      parameters: JSON.parse(strategy.parameters || '{}'),
      created_at: strategy.created_at.toISOString(),
      updated_at: strategy.updated_at.toISOString()
    };
  } catch (error) {
    console.error('Error getting strategy by ID:', error);
    return null;
  }
};

export const createStrategy = async (strategy: Omit<Strategy, 'id' | 'created_at' | 'updated_at'> & { contentType?: string, contentUrl?: string, enabled?: boolean }): Promise<Strategy | null> => {
  try {
    const id = `strategy_${Date.now()}`;
    
    await pool.execute(
      `INSERT INTO strategies (id, name, description, performance, risk_level, category, image_url, details, parameters, content_type, content_url, enabled) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        strategy.name,
        strategy.description,
        strategy.performance,
        strategy.riskLevel,
        strategy.category,
        strategy.imageUrl,
        strategy.details,
        JSON.stringify(strategy.parameters),
        strategy.contentType || null,
        strategy.contentUrl || null,
        strategy.enabled !== false
      ]
    );

    return await getStrategyById(id);
  } catch (error) {
    console.error('Error creating strategy:', error);
    return null;
  }
};

export const updateStrategy = async (id: string, updates: Partial<Strategy>): Promise<Strategy | null> => {
  try {
    const setClause = [];
    const values = [];

    if (updates.name) {
      setClause.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description) {
      setClause.push('description = ?');
      values.push(updates.description);
    }
    if (updates.performance !== undefined) {
      setClause.push('performance = ?');
      values.push(updates.performance);
    }
    if (updates.riskLevel) {
      setClause.push('risk_level = ?');
      values.push(updates.riskLevel);
    }
    if (updates.category) {
      setClause.push('category = ?');
      values.push(updates.category);
    }
    if (updates.imageUrl) {
      setClause.push('image_url = ?');
      values.push(updates.imageUrl);
    }
    if (updates.details) {
      setClause.push('details = ?');
      values.push(updates.details);
    }
    if (updates.parameters) {
      setClause.push('parameters = ?');
      values.push(JSON.stringify(updates.parameters));
    }
    if (updates.contentType) {
      setClause.push('content_type = ?');
      values.push(updates.contentType);
    }
    if (updates.contentUrl) {
      setClause.push('content_url = ?');
      values.push(updates.contentUrl);
    }
    if (updates.enabled !== undefined) {
      setClause.push('enabled = ?');
      values.push(updates.enabled);
    }

    if (setClause.length === 0) return await getStrategyById(id);

    values.push(id);
    
    await pool.execute(
      `UPDATE strategies SET ${setClause.join(', ')} WHERE id = ?`,
      values
    );

    return await getStrategyById(id);
  } catch (error) {
    console.error('Error updating strategy:', error);
    return null;
  }
};

export const deleteStrategy = async (id: string): Promise<boolean> => {
  try {
    await pool.execute('DELETE FROM strategies WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('Error deleting strategy:', error);
    return false;
  }
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
const ensureUserExistsInMySQL = async (userId: string) => {
  try {
    const [rows] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if ((rows as any[]).length > 0) return;

    const db = readDatabase();
    const jsonUser = db.users?.find((u: any) => u.id === userId);
    if (!jsonUser) return;

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
    const [historyRows] = await pool.execute(
      'SELECT * FROM analysis_history WHERE user_id = ? ORDER BY created_at DESC',
      [id]
    );
    
    const analysis_history = (historyRows as any[]).map(row => ({
      ...row,
      created_at: row.created_at.toISOString()
    }));

    return {
      ...user,
      wallet_balance: parseFloat(user.wallet_balance),
      analysis_history,
      created_at: user.created_at.toISOString(),
      updated_at: user.updated_at.toISOString()
    };
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
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
    console.error('Error getting all users:', error);
    return [];
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
    return { success: false, error: 'Failed to update tokens' };
  }
};

// Wallet transaction functions
export const createWalletTransaction = async (transactionData: {
  user_id: string;
  amount: number;
  transaction_type: 'deposit' | 'charge';
  payment_method?: string;
  transaction_id?: string;
  receipt_path?: string;
  platform?: 'MT4' | 'MT5';
  mt_account_id?: string;
  mt_account_password?: string; // Stored as plain text per requirement
  terms_accepted?: boolean;
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
    await ensureUserExistsInMySQL(transactionData.user_id);
    
    await pool.execute(
      `INSERT INTO wallet_transactions (id, user_id, amount, transaction_type, payment_method, transaction_id, receipt_path, platform, mt_account_id, mt_account_password, terms_accepted, inr_amount, inr_to_usd_rate, crypto_network, crypto_wallet_address, wallet_app_deeplink, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        transactionData.user_id,
        transactionData.amount,
        transactionData.transaction_type,
        transactionData.payment_method || null,
        transactionData.transaction_id || null,
        transactionData.receipt_path || null,
        transactionData.platform || null,
        transactionData.mt_account_id || null,
        transactionData.mt_account_password || null,
        transactionData.terms_accepted ?? false,
        transactionData.inr_amount ?? null,
        transactionData.inr_to_usd_rate ?? null,
        transactionData.crypto_network || null,
        transactionData.crypto_wallet_address || null,
        transactionData.wallet_app_deeplink || null,
        'pending'
      ]
    );

    return await getTransactionById(id);
  } catch (error) {
    console.error('Error creating wallet transaction:', error);
    return null;
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
    console.error('Error getting transaction by ID:', error);
    return null;
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
    console.error('Error getting pending transactions:', error);
    return [];
  }
};

export const getAllTransactions = async (): Promise<WalletTransaction[]> => {
  try {
    const [rows] = await pool.execute('SELECT * FROM wallet_transactions ORDER BY created_at DESC');
    
    return (rows as any[]).map(row => ({
      ...row,
      amount: parseFloat(row.amount),
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at ? row.updated_at.toISOString() : undefined
    }));
  } catch (error) {
    console.error('Error getting all transactions:', error);
    return [];
  }
};

export const updateTransactionStatus = async (
  transactionId: string,
  status: 'completed' | 'failed',
  adminId: string,
  tokensToAdd?: number
): Promise<{ success: boolean; transaction?: WalletTransaction; user?: Omit<User, 'password'> }> => {
  try {
    const transaction = await getTransactionById(transactionId);
    if (!transaction) {
      return { success: false };
    }

    // Update transaction status
    await pool.execute(
      'UPDATE wallet_transactions SET status = ?, admin_id = ? WHERE id = ?',
      [status, adminId, transactionId]
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
    return { success: true, transaction: updatedTransaction!, user: updatedUser };
  } catch (error) {
    console.error('Error updating transaction status:', error);
    return { success: false };
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