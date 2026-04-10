import pool from './db';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export const createRunningStrategyModification = async (mod: any) => {
  try {
    await pool.execute(
      'INSERT INTO running_strategy_modifications (id, running_strategy_id, user_id, status, new_update_json, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [mod.id, mod.running_strategy_id, mod.user_id, mod.status, JSON.stringify(mod.new_update_json)]
    );
    return true;
  } catch (error) {
    console.error('Error creating running strategy modification:', error);
    return false;
  }
};

export const createDisconnectSnapshot = async (snapshot: any) => {
  try {
    await pool.execute(
      'INSERT INTO disconnect_snapshots (id, running_strategy_id, user_id, positions, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [snapshot.id, snapshot.running_strategy_id, snapshot.user_id, JSON.stringify(snapshot.positions)]
    );
    return true;
  } catch (error) {
    console.error('Error creating disconnect snapshot:', error);
    return false;
  }
};

export const ensureRunningPeriodsTable = async (): Promise<void> => {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS running_periods (
        id VARCHAR(255) PRIMARY KEY,
        running_strategy_id VARCHAR(255) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_running_strategy_id (running_strategy_id),
        INDEX idx_start_time (start_time),
        INDEX idx_end_time (end_time)
      )
    `);
  } catch (error) {
    console.error('Failed to create running_periods table:', error);
  }
};

export const ensureProfitSharingTables = async () => {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS profit_settlements (
        id VARCHAR(255) PRIMARY KEY,
        strategy_id VARCHAR(255) NOT NULL,
        settlement_start TIMESTAMP NULL,
        settlement_end TIMESTAMP NOT NULL,
        total_profit DECIMAL(18,2) NOT NULL,
        total_commission DECIMAL(18,2) NOT NULL,
        total_withdrawal DECIMAL(18,2) NOT NULL,
        total_swap DECIMAL(18,2) NOT NULL,
        users_count INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS profit_settlement_items (
        id VARCHAR(255) PRIMARY KEY,
        settlement_id VARCHAR(255) NOT NULL,
        strategy_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255),
        user_email VARCHAR(255),
        invested_amount DECIMAL(18,2) NOT NULL,
        gross_profit DECIMAL(18,2) NOT NULL,
        swap_amount DECIMAL(18,2) NOT NULL,
        commission_amount DECIMAL(18,2) NOT NULL,
        withdrawal_amount DECIMAL(18,2) NOT NULL,
        settled_balance DECIMAL(18,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_settlement_id (settlement_id),
        INDEX idx_user_id (user_id),
        INDEX idx_strategy_id (strategy_id)
      )
    `);
  } catch (error) {
    console.error('ensureProfitSharingTables failed:', error);
  }
};

export const initializeDatabase = async () => {
  try {
    await ensureRunningPeriodsTable();
    await ensureProfitSharingTables();
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS disconnect_snapshots (
        id VARCHAR(255) PRIMARY KEY,
        running_strategy_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        positions JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS running_strategy_modifications (
        id VARCHAR(255) PRIMARY KEY,
        running_strategy_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        status ENUM('in-process', 'approved', 'rejected') DEFAULT 'in-process',
        new_update_json JSON,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Add missing columns to running_strategy_modifications if they don't exist (idempotent attempt)
    try {
      await pool.execute('ALTER TABLE running_strategy_modifications ADD COLUMN rejection_reason TEXT AFTER new_update_json');
    } catch (e) { /* ignore */ }
    try {
      await pool.execute('ALTER TABLE running_strategy_modifications ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
    } catch (e) { /* ignore */ }

    // Add capital column to running_strategies if it doesn't exist
    try {
      await pool.execute('ALTER TABLE running_strategies ADD COLUMN closed_at TIMESTAMP NULL AFTER updated_at');
    } catch (e) { /* ignore */ }
    try {
      await pool.execute('ALTER TABLE running_strategies ADD COLUMN lot_size DECIMAL(10, 4) DEFAULT 1.0000 AFTER capital');
    } catch (e) { /* ignore */ }
    try {
      await pool.execute('ALTER TABLE running_strategies ADD COLUMN deleted_at TIMESTAMP NULL AFTER closed_at');
    } catch (e) { /* ignore */ }

    try {
      await pool.execute('ALTER TABLE wallet_transactions ADD COLUMN capital DECIMAL(10, 2) DEFAULT 0 AFTER amount');
    } catch (e) { /* ignore */ }
    try {
      await pool.execute('ALTER TABLE wallet_transactions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
    } catch (e) { /* ignore */ }
    try {
      await pool.execute('ALTER TABLE wallet_transactions ADD COLUMN running_strategy_id VARCHAR(255) AFTER strategy_id');
    } catch (e) { /* ignore */ }
    try {
      await pool.execute('ALTER TABLE wallet_transactions ADD COLUMN lot_size DECIMAL(10, 4) NULL AFTER strategy_id');
    } catch (e) { /* ignore */ }

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        capital DECIMAL(10, 2) DEFAULT 0,
        transaction_type ENUM('deposit', 'charge', 'withdrawal', 'commission', 'swap', 'settled') NOT NULL,
        payment_method VARCHAR(50),
        transaction_id VARCHAR(100),
        receipt_path VARCHAR(255),
        platform ENUM('MT4', 'MT5'),
        mt_account_id VARCHAR(255),
        mt_account_password VARCHAR(255),
        terms_accepted BOOLEAN DEFAULT FALSE,
        strategy_id VARCHAR(255),
        running_strategy_id VARCHAR(255),
        plan_level ENUM('Premium','Expert','Pro'),
        inr_amount DECIMAL(12, 2),
        inr_to_usd_rate DECIMAL(12, 6),
        crypto_network ENUM('ERC20','TRC20'),
        crypto_wallet_address VARCHAR(128),
        wallet_app_deeplink VARCHAR(255),
        status ENUM('pending','in-process','completed','failed','settled') DEFAULT 'pending',
        admin_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (running_strategy_id) REFERENCES running_strategies(id) ON DELETE SET NULL
      )
    `);

    // Expand ENUMs for existing wallet_transactions table
    try {
      await pool.execute("ALTER TABLE wallet_transactions MODIFY COLUMN transaction_type ENUM('deposit', 'charge', 'withdrawal', 'commission', 'swap', 'settled') NOT NULL");
      await pool.execute("ALTER TABLE wallet_transactions MODIFY COLUMN status ENUM('pending','in-process','completed','failed','settled') DEFAULT 'pending'");
    } catch (e) {
      console.error('Failed to update wallet_transactions ENUMs:', e);
    }

    return true;
  } catch (error) {
    console.error('initializeDatabase failed:', error);
    return false;
  }
};

export const createWalletTransaction = async (data: any) => {
  try {
    const id = data.id || uuidv4();
    const transaction_id = data.transaction_id || `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // Get available columns from the actual table
    const [columns]: any = await pool.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_transactions'
      ORDER BY ORDINAL_POSITION
    `);
    const availableColumns = Array.isArray(columns) ? columns.map((row: any) => row.COLUMN_NAME) : [];

    // Build the insert based on available columns and provided data
    const insertData: any = {
      id,
      user_id: data.user_id,
      amount: data.amount,
      transaction_type: data.transaction_type || 'deposit',
      payment_method: data.payment_method,
      transaction_id,
      receipt_path: data.receipt_path,
      status: data.status || 'pending',
      platform: data.platform,
      mt_account_id: data.mt_account_id,
      mt_account_password: data.mt_account_password,
      terms_accepted: data.terms_accepted ? 1 : 0,
      strategy_id: data.strategy_id,
      lot_size: data.lot_size ?? data.lotSize,
      running_strategy_id: data.running_strategy_id,
      plan_level: data.plan_level,
      inr_amount: data.inr_amount,
      inr_to_usd_rate: data.inr_to_usd_rate,
      crypto_network: data.crypto_network,
      crypto_wallet_address: data.crypto_wallet_address,
      wallet_app_deeplink: data.wallet_app_deeplink,
    };

    // Filter to only include columns that exist in the table and values that can be bound
    const validEntries = Object.entries(insertData).filter(
      ([key, value]) => availableColumns.includes(key) && value !== undefined
    );
    const finalFields = validEntries.map(([key]) => key);
    const finalValues = validEntries.map(([, value]) => (value === undefined ? null : value));
    const finalPlaceholders = finalFields.map(() => '?').join(', ');

    if (finalFields.length === 0) {
      throw new Error('No valid fields to insert');
    }

    await pool.execute(
      `INSERT INTO wallet_transactions (${finalFields.join(', ')}) VALUES (${finalPlaceholders})`,
      finalValues
    );
    return { id, transaction_id, ...data };
  } catch (error) {
    console.error('createWalletTransaction failed:', error);
    return null;
  }
};

export const getTransactionsByUser = async (userId: string) => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    return rows;
  } catch (error) {
    console.error('getTransactionsByUser failed:', error);
    return [];
  }
};

export const updateTransactionProof = async (id: string, proofUrl: string) => {
  try {
    await pool.execute('UPDATE wallet_transactions SET admin_message = ? WHERE id = ?', [`Proof: ${proofUrl}`, id]);
    return true;
  } catch (error) {
    console.error('updateTransactionProof failed:', error);
    return false;
  }
};

export const updateWalletTransactionStatus = async (id: string, status: string) => {
  try {
    await pool.execute('UPDATE wallet_transactions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    return true;
  } catch (error) {
    console.error('updateWalletTransactionStatus failed:', error);
    return false;
  }
};

export const getWalletBalance = async (userId: string) => {
  try {
    const [rows]: any = await pool.execute(
      `SELECT 
        SUM(CASE 
          WHEN transaction_type = 'deposit' AND status IN ('completed','settled','approved') THEN amount 
          WHEN transaction_type = 'charge' AND status IN ('completed','settled','approved') THEN -amount 
          WHEN transaction_type = 'withdrawal' AND status IN ('completed','settled','approved') THEN -amount 
          WHEN transaction_type = 'settled' AND status IN ('completed','settled','approved') THEN amount
          ELSE 0 END) as balance 
       FROM wallet_transactions 
       WHERE user_id = ?`,
      [userId]
    );

    // Hard rule: wallet balance is derived only from completed wallet ledger transactions.
    // No extra subtraction from running_strategies to prevent double-deduct bugs.
    const ledgerBalance = Number(rows[0]?.balance || 0);
    return Number(ledgerBalance.toFixed(2));
  } catch (error) {
    console.error('getWalletBalance failed:', error);
    return 0;
  }
};

export const getLatestLotSizeForUserStrategy = async (
  userId: string,
  strategyId: string,
  runningStrategyId?: string
): Promise<number> => {
  try {
    // Prefer lot size from the exact running strategy if present.
    if (runningStrategyId) {
      try {
        const [rows]: any = await pool.execute(
          `SELECT lot_size
           FROM wallet_transactions
           WHERE user_id = ?
             AND strategy_id = ?
             AND running_strategy_id = ?
             AND transaction_type IN ('charge', 'deposit')
             AND status IN ('completed','approved','settled')
             AND lot_size IS NOT NULL
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId, strategyId, runningStrategyId]
        );
        const lot = Number(rows?.[0]?.lot_size ?? 0);
        if (Number.isFinite(lot) && lot > 0) return lot;
      } catch {
        // Ignore if lot_size column does not exist in this environment.
      }
    }

    // Fallback to latest strategy-level completed transaction lot size.
    try {
      const [rows]: any = await pool.execute(
        `SELECT lot_size
         FROM wallet_transactions
         WHERE user_id = ?
           AND strategy_id = ?
           AND transaction_type IN ('charge', 'deposit')
           AND status IN ('completed','approved','settled')
           AND lot_size IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, strategyId]
      );
      const lot = Number(rows?.[0]?.lot_size ?? 0);
      if (Number.isFinite(lot) && lot > 0) return lot;
    } catch {
      // Ignore if lot_size column does not exist.
    }

    return 1;
  } catch (error) {
    console.error('getLatestLotSizeForUserStrategy failed:', error);
    return 1;
  }
};

export const linkWalletTransactionsToRunningStrategy = async (runningStrategyId: string, userId: string, strategyId: string) => {
  try {
    // Link ALL unlinked deposit/charge transactions for this user+strategy to the running_strategy
    // (not just LIMIT 2, since multiple deposits might exist from payment retries or other reasons)
    const [result]: any = await pool.execute(
      'UPDATE wallet_transactions SET running_strategy_id = ? WHERE user_id = ? AND strategy_id = ? AND transaction_type IN ("deposit", "charge") AND running_strategy_id IS NULL',
      [runningStrategyId, userId, strategyId]
    );
    const affectedRows = result.affectedRows || 0;
    console.log(`[linkWalletTransactions] Linked ${affectedRows} wallet_transactions to running_strategy ${runningStrategyId}`);
    return true;
  } catch (error) {
    console.error('linkWalletTransactionsToRunningStrategy failed:', error);
    return false;
  }
};

export const rejectRunningStrategyModification = async (id: string, reason: string = 'No reason provided') => {
  try {
    await pool.execute(
      'UPDATE running_strategy_modifications SET status = "rejected", rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [reason, id]
    );
    return true;
  } catch (error) {
    console.error('rejectRunningStrategyModification failed:', error);
    return false;
  }
};

// JSON Database helpers (Fallback)
const DB_PATH = path.join(process.cwd(), 'src/db/database.json');

export const readDatabase = () => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return { users: [], strategies: [], wallet_transactions: [], running_strategies: [], disconnect_snapshots: [], running_strategy_modifications: [], running_periods: [] };
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading JSON database:', error);
    return { users: [], strategies: [], wallet_transactions: [], running_strategies: [], disconnect_snapshots: [], running_strategy_modifications: [], running_periods: [] };
  }
};

export const writeDatabase = (data: any) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing JSON database:', error);
  }
};

export const getUserById = async (id: string) => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    const db = readDatabase();
    return db.users.find((u: any) => u.id === id) || null;
  }
};

export const getAllUsers = async () => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM users');
    return rows;
  } catch (error) {
    console.error('Error getting all users:', error);
    const db = readDatabase();
    return db.users;
  }
};

export const getStrategyById = async (id: string) => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM strategies WHERE id = ?', [id]);
    if (!rows[0]) return null;
    const s = rows[0];
    const parsedParameters = typeof s.parameters === 'string' ? JSON.parse(s.parameters || '{}') : s.parameters || {};
    if (parsedParameters.lot_size !== undefined && parsedParameters.lotSize === undefined) {
      parsedParameters.lotSize = Number(parsedParameters.lot_size);
    }
    const rawRiskScore = s.risk_score ?? s.riskScore ?? parsedParameters.riskScore ?? parsedParameters.risk_score;
    return {
      ...s,
      masterAccountId: s.master_account_id,
      masterAccountPassword: s.master_account_password,
      masterAccountServer: s.master_account_server,
      masterPlatform: s.master_platform,
      roi: s.roi !== undefined && s.roi !== null ? Number(s.roi) : undefined,
      profit: s.profit !== undefined && s.profit !== null ? Number(s.profit) : undefined,
      maxDdi: s.max_ddi !== undefined && s.max_ddi !== null ? Number(s.max_ddi) : undefined,
      copiers: s.copiers !== undefined && s.copiers !== null ? Number(s.copiers) : undefined,
      riskScore: rawRiskScore !== undefined && rawRiskScore !== null ? Number(rawRiskScore) : undefined,
      minCapital: s.min_capital !== undefined && s.min_capital !== null ? Number(s.min_capital) : undefined,
      avgDrawdown: s.avg_drawdown !== undefined && s.avg_drawdown !== null ? Number(s.avg_drawdown) : undefined,
      riskReward: s.risk_reward !== undefined && s.risk_reward !== null ? Number(s.risk_reward) : undefined,
      winStreak: s.win_streak !== undefined && s.win_streak !== null ? Number(s.win_streak) : undefined,
      imageUrl: s.image_url,
      parameters: parsedParameters,
      planPrices: typeof s.plan_prices === 'string' ? JSON.parse(s.plan_prices || '{}') : s.plan_prices,
      planDetails: typeof s.plan_details === 'string' ? JSON.parse(s.plan_details || '{}') : s.plan_details,
    };
  } catch (error) {
    console.error('Error getting strategy by ID:', error);
    const db = readDatabase();
    return db.strategies.find((s: any) => s.id === id) || null;
  }
};

export const getAllStrategies = async () => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM strategies');
    return rows.map((s: any) => {
      const parsedParameters = typeof s.parameters === 'string' ? JSON.parse(s.parameters || '{}') : s.parameters || {};
      const rawRiskScore = s.risk_score ?? s.riskScore ?? parsedParameters.riskScore ?? parsedParameters.risk_score;
      if (parsedParameters.lot_size !== undefined && parsedParameters.lotSize === undefined) {
        parsedParameters.lotSize = Number(parsedParameters.lot_size);
      }
      return {
        ...s,
        masterAccountId: s.master_account_id,
        masterAccountPassword: s.master_account_password,
        masterAccountServer: s.master_account_server,
        masterPlatform: s.master_platform,
        roi: s.roi !== undefined && s.roi !== null ? Number(s.roi) : undefined,
        profit: s.profit !== undefined && s.profit !== null ? Number(s.profit) : undefined,
        maxDdi: s.max_ddi !== undefined && s.max_ddi !== null ? Number(s.max_ddi) : undefined,
        copiers: s.copiers !== undefined && s.copiers !== null ? Number(s.copiers) : undefined,
        riskScore: rawRiskScore !== undefined && rawRiskScore !== null ? Number(rawRiskScore) : undefined,
        minCapital: s.min_capital !== undefined && s.min_capital !== null ? Number(s.min_capital) : undefined,
        avgDrawdown: s.avg_drawdown !== undefined && s.avg_drawdown !== null ? Number(s.avg_drawdown) : undefined,
        riskReward: s.risk_reward !== undefined && s.risk_reward !== null ? Number(s.risk_reward) : undefined,
        winStreak: s.win_streak !== undefined && s.win_streak !== null ? Number(s.win_streak) : undefined,
        imageUrl: s.image_url,
        parameters: parsedParameters,
        planPrices: typeof s.plan_prices === 'string' ? JSON.parse(s.plan_prices || '{}') : s.plan_prices,
        planDetails: typeof s.plan_details === 'string' ? JSON.parse(s.plan_details || '{}') : s.plan_details,
      };
    });
  } catch (error) {
    console.error('Error getting all strategies:', error);
    const db = readDatabase();
    return db.strategies;
  }
};

export const getRunningStrategyById = async (id: string) => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM running_strategies WHERE id = ?', [id]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      strategyId: r.strategy_id,
      userId: r.user_id,
      mtAccountId: r.mt_account_id,
      mtAccountPassword: r.mt_account_password,
      mtAccountServer: r.mt_account_server,
    };
  } catch (error) {
    console.error('Error getting running strategy by ID:', error);
    const db = readDatabase();
    return db.running_strategies.find((r: any) => r.id === id) || null;
  }
};

export const getRunningStrategiesForUser = async (userId: string) => {
  try {
    // Try to filter by deleted_at if the column exists
    let query = 'SELECT * FROM running_strategies WHERE user_id = ?';
    let params = [userId];

    try {
      // Check if deleted_at column exists by running a simple query
      await pool.execute('SELECT deleted_at FROM running_strategies LIMIT 1');
      query += ' AND deleted_at IS NULL';
    } catch (e) {
      console.warn('[dbService] deleted_at column might not exist yet, skipping filter');
    }

    query += ' AND admin_status NOT IN ("disconnected","stopped") AND status NOT IN ("stopped","error")';
    
    const [rows]: any = await pool.execute(query, params);
    return rows.map((r: any) => ({
      ...r,
      strategyId: r.strategy_id,
      userId: r.user_id,
      mtAccountId: r.mt_account_id,
      mtAccountPassword: r.mt_account_password,
      mtAccountServer: r.mt_account_server,
    }));
  } catch (error) {
    console.error('Error getting running strategies for user:', error);
    return [];
  }
};

export const getClosedStrategiesForUser = async (userId: string) => {
  try {
    try {
      // Check if deleted_at column exists
      await pool.execute('SELECT deleted_at FROM running_strategies LIMIT 1');
      const [rows]: any = await pool.execute(
        'SELECT * FROM running_strategies WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC',
        [userId]
      );
      return rows.map((r: any) => ({
        ...r,
        strategyId: r.strategy_id,
        userId: r.user_id,
        mtAccountId: r.mt_account_id,
        mtAccountPassword: r.mt_account_password,
        mtAccountServer: r.mt_account_server,
      }));
    } catch (e) {
      console.warn('[dbService] deleted_at column might not exist yet, returning empty closed list');
      return [];
    }
  } catch (error) {
    console.error('Error getting closed strategies for user:', error);
    return [];
  }
};

export const getRunningStrategyTotalCapital = async (strategyId: string) => {
  try {
    const [rows]: any = await pool.execute(
      'SELECT SUM(capital) as total_capital FROM running_strategies WHERE strategy_id = ? AND (status = "active" OR admin_status = "running")',
      [strategyId]
    );
    return Number(rows[0]?.total_capital || 0);
  } catch (error) {
    console.error('Error getting running strategy total capital:', error);
    return 0;
  }
};

export const getUserStrategyDeposit = async (userId: string, strategyId: string) => {
  try {
    const [rows]: any = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total_deposit
       FROM wallet_transactions
       WHERE user_id = ?
         AND strategy_id = ?
         AND transaction_type IN ('deposit', 'charge', 'transfer', 'payment', 'topup', 'settled')
         AND status IN ('completed', 'settled', 'approved', 'in-process')`,
      [userId, strategyId]
    );
    return Number(rows[0]?.total_deposit || 0);
  } catch (error) {
    console.error('Error getting user strategy deposit:', error);
    return 0;
  }
};

export const updateRunningStrategyAdminStatus = async (id: string, status: string): Promise<boolean> => {
  try {
    let userStatus = 'in-process';
    if (status === 'running') userStatus = 'active';
    else if (status === 'disconnected') userStatus = 'stopped';
    else if (status.startsWith('wrong-')) userStatus = 'error';

    await pool.execute(
      'UPDATE running_strategies SET admin_status = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, userStatus, id]
    );
    return true;
  } catch (error) {
    console.error('Error updating running strategy admin status:', error);
    const db: any = readDatabase();
    const index = db.running_strategies.findIndex((r: any) => r.id === id);
    if (index !== -1) {
      let userStatus = 'in-process';
      if (status === 'running') userStatus = 'active';
      else if (status === 'disconnected') userStatus = 'stopped';
      db.running_strategies[index].admin_status = status;
      db.running_strategies[index].status = userStatus;
      db.running_strategies[index].updated_at = new Date().toISOString();
      writeDatabase(db);
      return true;
    }
    return false;
  }
};

export const deleteRunningStrategy = async (id: string): Promise<boolean> => {
  try {
    // Instead of hard deleting, we mark it as closed and deleted_at for archiving
    const [result]: any = await pool.execute(
      'UPDATE running_strategies SET status = "stopped", admin_status = "disconnected", closed_at = CURRENT_TIMESTAMP, deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error deleting running strategy:', error);
    return false;
  }
};

export const purgeOldStrategies = async () => {
  try {
    // Permanently delete strategies closed more than 30 days ago
    const [result]: any = await pool.execute(
      'DELETE FROM running_strategies WHERE deleted_at IS NOT NULL AND deleted_at < DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );
    console.log(`[Purge] Permanently deleted ${result.affectedRows} old closed strategies`);
    return result.affectedRows;
  } catch (error) {
    console.error('Error purging old strategies:', error);
    return 0;
  }
};

export const clearStrategyCache = async (strategyId: string): Promise<void> => {
  try {
    // This function would be called from the frontend to clear localStorage
    // Since we can't directly access localStorage from server, we'll log it for client-side cleanup
    console.log(`[StrategyCleanup] Cache cleanup needed for strategy: ${strategyId}`);
    console.log(`[StrategyCleanup] Client should clear localStorage keys: copier_history_cache_${strategyId}`);
  } catch (error) {
    console.error('Error clearing strategy cache:', error);
  }
};


export const startRunningPeriod = async (runningStrategyId: string): Promise<void> => {
  await ensureRunningPeriodsTable();
  const id = `rp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await endRunningPeriod(runningStrategyId);
    await pool.execute(
      'INSERT INTO running_periods (id, running_strategy_id, start_time) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [id, runningStrategyId]
    );
  } catch (error) {
    console.error('Error starting running period:', error);
  }
};

export const endRunningPeriod = async (runningStrategyId: string): Promise<void> => {
  await ensureRunningPeriodsTable();
  try {
    await pool.execute(
      'UPDATE running_periods SET end_time = CURRENT_TIMESTAMP WHERE running_strategy_id = ? AND end_time IS NULL',
      [runningStrategyId]
    );
  } catch (error) {
    console.error('Error ending running period:', error);
  }
};

export const getRunningPeriods = async (runningStrategyId: string): Promise<any[]> => {
  await ensureRunningPeriodsTable();
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM running_periods WHERE running_strategy_id = ? ORDER BY start_time ASC',
      [runningStrategyId]
    );
    return (rows as any[]).map(r => ({
      ...r,
      start_time: r.start_time.toISOString(),
      end_time: r.end_time ? r.end_time.toISOString() : null
    }));
  } catch (error) {
    console.error('Error getting running periods:', error);
    return [];
  }
};

export const approveRunningStrategyModification = async (id: string, adminId: string): Promise<boolean> => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM running_strategy_modifications WHERE id = ?', [id]);
    if (rows.length === 0) return false;
    const mod = rows[0];
    const nu = typeof mod.new_update_json === 'string' ? JSON.parse(mod.new_update_json || '{}') : (mod.new_update_json || {});
    const rsId = mod.running_strategy_id;

    if (nu.action === 'disconnect') {
      await updateRunningStrategyAdminStatus(rsId, 'disconnected');
      await endRunningPeriod(rsId);
    } else if (nu.action === 'enable' || nu.action === 'connect') {
      await updateRunningStrategyAdminStatus(rsId, 'running');
      await startRunningPeriod(rsId);
    }

    // Mark modification as approved - attempt with updated_at, fallback if column missing
    try {
      await pool.execute(
        'UPDATE running_strategy_modifications SET status = "approved", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
    } catch (e) {
      await pool.execute(
        'UPDATE running_strategy_modifications SET status = "approved" WHERE id = ?',
        [id]
      );
    }
    return true;
  } catch (error) {
    console.error('Error approving running strategy modification:', error);
    return false;
  }
};

export const getPendingModificationsForStrategy = async (rsId: string) => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM running_strategy_modifications WHERE running_strategy_id = ? AND status = "in-process"', [rsId]);
    return rows;
  } catch (error) {
    console.error('Error getting pending modifications:', error);
    return [];
  }
};

export const getRunningStrategyModificationById = async (id: string) => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM running_strategy_modifications WHERE id = ?', [id]);
    return rows[0] || null;
  } catch (error) {
    console.error('Error getting modification by ID:', error);
    return null;
  }
};

export const updateRunningStrategyMtDetails = async (rsId: string, updates: any) => {
  try {
    const fields = [];
    const values = [];
    if (updates.mt_account_id) { fields.push('mt_account_id = ?'); values.push(updates.mt_account_id); }
    if (updates.mt_account_password) { fields.push('mt_account_password = ?'); values.push(updates.mt_account_password); }
    if (updates.mt_account_server) { fields.push('mt_account_server = ?'); values.push(updates.mt_account_server); }
    if (updates.platform) { fields.push('platform = ?'); values.push(updates.platform); }
    
    if (fields.length === 0) return true;
    values.push(rsId);
    await pool.execute(`UPDATE running_strategies SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
    return true;
  } catch (error) {
    console.error('Error updating MT details:', error);
    return false;
  }
};

export const getCachedMasterTrades = async (masterId: string) => {
  try {
    const [history]: any = await pool.execute('SELECT * FROM master_trades_cache WHERE master_id = ? AND is_open = 0', [masterId]);
    const [open]: any = await pool.execute('SELECT * FROM master_trades_cache WHERE master_id = ? AND is_open = 1', [masterId]);
    return { history, open_positions: open, last_updated: new Date().toISOString() };
  } catch (error) {
    console.error('Error getting cached trades:', error);
    return { history: [], open_positions: [], last_updated: new Date().toISOString() };
  }
};

export const upsertMasterTrades = async (masterId: string, trades: any[], isOpen: boolean) => {
  if (!Array.isArray(trades) || trades.length === 0) return;

  try {
    const rows = trades.map((trade) => {
      const positionId = String(trade.position_id || trade.ticket || trade.id || '');
      // Create a deterministic ID to avoid duplicates
      const id = `${masterId}_${positionId}`;
      
      return [
        id,
        masterId,
        positionId,
        trade.symbol || null,
        trade.type || null,
        Number(trade.volume || 0),
        Number(trade.price_open || 0),
        Number(trade.price_close ?? trade.price_current ?? null),
        Number(trade.profit || 0),
        Number(trade.commission || 0),
        Number(trade.swap || 0),
        trade.time_open || trade.time || null,
        trade.time_close || null,
        isOpen ? 1 : 0,
      ];
    });

    const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const params = rows.reduce((acc, row) => acc.concat(row), []);

    await pool.execute(
      `REPLACE INTO master_trades_cache (
        id, master_id, position_id, symbol, type, volume, price_open, price_close,
        profit, commission, swap, time_open, time_close, is_open
      ) VALUES ${placeholders}`,
      params
    );
  } catch (error) {
    console.error('Error upserting master trades (bulk):', error);

    try {
      for (const trade of trades) {
        const positionId = String(trade.position_id || trade.ticket || trade.id || '');
        const id = `${masterId}_${positionId}`;
        
        await pool.execute(
          `REPLACE INTO master_trades_cache (
            id, master_id, position_id, symbol, type, volume, price_open, price_close,
            profit, commission, swap, time_open, time_close, is_open
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            masterId,
            positionId,
            trade.symbol || null,
            trade.type || null,
            Number(trade.volume || 0),
            Number(trade.price_open || 0),
            Number(trade.price_close ?? trade.price_current ?? null),
            Number(trade.profit || 0),
            Number(trade.commission || 0),
            Number(trade.swap || 0),
            trade.time_open || trade.time || null,
            trade.time_close || null,
            isOpen ? 1 : 0,
          ]
        );
      }
    } catch (innerError) {
      console.error('Error upserting master trades row-by-row:', innerError);
    }
  }
};

export const reconcileMasterOpenPositions = async (masterId: string, liveOpenPositions: any[]) => {
  try {
    const liveIds = liveOpenPositions.map(p => String(p.position_id || p.ticket || p.id));
    if (liveIds.length > 0) {
      const placeholders = liveIds.map(() => '?').join(',');
      await pool.execute(
        `UPDATE master_trades_cache SET is_open = 0 WHERE master_id = ? AND is_open = 1 AND position_id NOT IN (${placeholders})`,
        [masterId, ...liveIds]
      );
    } else {
      await pool.execute('UPDATE master_trades_cache SET is_open = 0 WHERE master_id = ? AND is_open = 1', [masterId]);
    }
  } catch (error) {
    console.error('Error reconciling open positions:', error);
  }
};

export const getSettlementsByUserAndStrategy = async (userId: string, strategyId: string): Promise<any[]> => {
  try {
    const [rows]: any = await pool.execute(`
      SELECT psi.*, ps.settlement_start, ps.settlement_end
      FROM profit_settlement_items psi
      JOIN profit_settlements ps ON psi.settlement_id = ps.id
      WHERE psi.user_id = ? AND psi.strategy_id = ?
      ORDER BY ps.settlement_end DESC
    `, [userId, strategyId]);
    
    return rows.map((r: any) => ({
      ...r,
      settlementStart: r.settlement_start ? r.settlement_start.toISOString() : null,
      settlementEnd: r.settlement_end ? r.settlement_end.toISOString() : null,
      createdAt: r.created_at ? r.created_at.toISOString() : null
    }));
  } catch (error) {
    console.error('getSettlementsByUserAndStrategy failed:', error);
    return [];
  }
};

export const getAllSettlements = async (): Promise<any[]> => {
  try {
    const [rows]: any = await pool.execute(`
      SELECT psi.*, ps.settlement_start, ps.settlement_end
      FROM profit_settlement_items psi
      JOIN profit_settlements ps ON psi.settlement_id = ps.id
      ORDER BY ps.settlement_end DESC
    `);

    return rows.map((r: any) => ({
      ...r,
      settlementStart: r.settlement_start ? r.settlement_start.toISOString() : null,
      settlementEnd: r.settlement_end ? r.settlement_end.toISOString() : null,
      createdAt: r.created_at ? r.created_at.toISOString() : null
    }));
  } catch (error) {
    console.error('getAllSettlements failed:', error);
    return [];
  }
};

export const getDisconnectSnapshots = async (rsId: string) => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM disconnect_snapshots WHERE running_strategy_id = ?', [rsId]);
    return rows;
  } catch (error) {
    console.error('Error getting disconnect snapshots:', error);
    return [];
  }
};

export const getRunningStrategyModifications = async (rsId: string) => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM running_strategy_modifications WHERE running_strategy_id = ?', [rsId]);
    return rows;
  } catch (error) {
    console.error('Error getting modifications:', error);
    return [];
  }
};

export const createUser = async (nameOrConfig: string | any, email?: string, passwordPlain?: string) => {
  try {
    // Support both object and positional arguments
    let name: string;
    let userEmail: string;
    let password: string;
    
    if (typeof nameOrConfig === 'object') {
      // Object format: { name, email, password, country_code?, country? }
      name = nameOrConfig.name;
      userEmail = nameOrConfig.email;
      password = nameOrConfig.password;
    } else {
      // Positional arguments: (name, email, password)
      name = nameOrConfig;
      userEmail = email!;
      password = passwordPlain!;
    }
    
    if (!name || !userEmail || !password) {
      return { success: false, error: 'Missing required fields: name, email, password' };
    }
    
    const id = `user_${Date.now()}`;
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.execute(
      'INSERT INTO users (id, name, email, password, role, created_at) VALUES (?, ?, ?, ?, "USER", CURRENT_TIMESTAMP)',
      [id, name, userEmail.toLowerCase(), hashedPassword]
    );
    return { success: true, user: { id, name, email: userEmail.toLowerCase(), role: 'USER' } };
  } catch (error: any) {
    console.error('createUser failed:', error);
    return { success: false, error: error.message };
  }
};

export const loginUser = async (email: string, passwordPlain: string) => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (rows.length === 0) return { success: false, error: 'User not found' };
    const user = rows[0];
    const isMatch = await bcrypt.compare(passwordPlain, user.password);
    if (!isMatch) return { success: false, error: 'Invalid password' };
    return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, country: user.country } };
  } catch (error: any) {
    console.error('loginUser failed:', error);
    return { success: false, error: error.message };
  }
};

export const setTransactionAdminMessage = async (id: string, message: string) => {
  try {
    await pool.execute('UPDATE wallet_transactions SET admin_message = ? WHERE id = ?', [message, id]);
    return true;
  } catch (error) {
    console.error('setTransactionAdminMessage failed:', error);
    return false;
  }
};

export const deleteRunningStrategyForUserStrategy = async (userId: string, strategyId: string) => {
  try {
    const [rows]: any = await pool.execute('SELECT id FROM running_strategies WHERE user_id = ? AND strategy_id = ?', [userId, strategyId]);
    if (Array.isArray(rows) && rows.length > 0) {
      for (const row of rows) {
        if (row && row.id) {
          await deleteRunningStrategy(row.id);
          await clearStrategyCache(row.id);
        }
      }
      return true;
    }

    // Fallback delete (if no result from select, remove any row directly)
    await pool.execute('DELETE FROM running_strategies WHERE user_id = ? AND strategy_id = ?', [userId, strategyId]);
    return true;
  } catch (error) {
    console.error('deleteRunningStrategyForUserStrategy failed:', error);
    return false;
  }
};

export const getPendingOrInProcessTransactions = async () => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM wallet_transactions WHERE status IN ("pending", "in-process") ORDER BY created_at DESC');
    return rows;
  } catch (error) {
    console.error('getPendingOrInProcessTransactions failed:', error);
    return [];
  }
};

export const getRunningStrategyModificationsAdmin = async () => {
  try {
    const [rows]: any = await pool.execute(`
      SELECT rsm.*, u.name as user_name, s.name as strategy_name, rs.capital as current_balance, rs.admin_status as current_admin_status
      FROM running_strategy_modifications rsm
      JOIN users u ON rsm.user_id = u.id
      JOIN running_strategies rs ON rsm.running_strategy_id = rs.id
      JOIN strategies s ON rs.strategy_id = s.id
      ORDER BY rsm.created_at DESC
    `);
    return rows;
  } catch (error) {
    console.error('getRunningStrategyModificationsAdmin failed:', error);
    return [];
  }
};

export const updateStrategy = async (id: string, updates: any) => {
  try {
    const fields = [];
    const values = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.imageUrl !== undefined) { fields.push('image_url = ?'); values.push(updates.imageUrl); }
    if (updates.details !== undefined) { fields.push('details = ?'); values.push(updates.details); }
    if (updates.performance !== undefined) { fields.push('performance = ?'); values.push(updates.performance); }
    if (updates.riskLevel !== undefined) { fields.push('risk_level = ?'); values.push(updates.riskLevel); }
    if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category); }

    if (updates.parameters) {
      const merged = { ...updates.parameters };
      if (updates.riskScore !== undefined) merged.riskScore = updates.riskScore;
      fields.push('parameters = ?');
      values.push(JSON.stringify(merged));
    } else if (updates.riskScore !== undefined) {
      const existing = await getStrategyById(id);
      const merged = { ...((existing && existing.parameters) || {}), riskScore: updates.riskScore };
      fields.push('parameters = ?');
      values.push(JSON.stringify(merged));
    }

    const planPrices = updates.planPrices || updates.plan_prices;
    if (planPrices !== undefined) { fields.push('plan_prices = ?'); values.push(JSON.stringify(planPrices)); }

    const planDetails = updates.planDetails || updates.plan_details;
    if (planDetails !== undefined) { fields.push('plan_details = ?'); values.push(JSON.stringify(planDetails)); }

    if (updates.roi !== undefined) { fields.push('roi = ?'); values.push(updates.roi); }
    if (updates.profit !== undefined) { fields.push('profit = ?'); values.push(updates.profit); }
    if (updates.maxDdi !== undefined) { fields.push('max_ddi = ?'); values.push(updates.maxDdi); }
    if (updates.copiers !== undefined) { fields.push('copiers = ?'); values.push(updates.copiers); }
    if (updates.minCapital !== undefined) { fields.push('min_capital = ?'); values.push(updates.minCapital); }
    if (updates.avgDrawdown !== undefined) { fields.push('avg_drawdown = ?'); values.push(updates.avgDrawdown); }
    if (updates.riskReward !== undefined) { fields.push('risk_reward = ?'); values.push(updates.riskReward); }
    if (updates.winStreak !== undefined) { fields.push('win_streak = ?'); values.push(updates.winStreak); }
    if (updates.tag !== undefined) { fields.push('tag = ?'); values.push(updates.tag); }
    if (updates.mastersTag !== undefined) { fields.push('masters_tag = ?'); values.push(updates.mastersTag); }
    if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }

    if (updates.masterAccountId !== undefined) { fields.push('master_account_id = ?'); values.push(updates.masterAccountId); }
    if (updates.masterAccountPassword !== undefined) { fields.push('master_account_password = ?'); values.push(updates.masterAccountPassword); }
    if (updates.masterAccountServer !== undefined) { fields.push('master_account_server = ?'); values.push(updates.masterAccountServer); }
    if (updates.masterPlatform !== undefined) { fields.push('master_platform = ?'); values.push(updates.masterPlatform); }

    if (fields.length === 0) return true;
    values.push(id);
    await pool.execute(`UPDATE strategies SET ${fields.join(', ')} WHERE id = ?`, values);
    return true;
  } catch (error) {
    console.error('updateStrategy failed:', error);
    return false;
  }
};

export const createStrategy = async (strategy: any) => {
  try {
    const id = strategy.id || `strat_${Date.now()}`;
    const mergedParameters: any = {
      ...(strategy.parameters || {}),
    };
    if (strategy.riskScore !== undefined && strategy.riskScore !== null) {
      mergedParameters.riskScore = strategy.riskScore;
    }

    await pool.execute(
      'INSERT INTO strategies (id, name, description, image_url, details, performance, risk_level, category, parameters, plan_prices, plan_details, roi, profit, max_ddi, copiers, min_capital, avg_drawdown, risk_reward, win_streak, tag, masters_tag, enabled, master_account_id, master_account_password, master_account_server, master_platform) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        strategy.name,
        strategy.description || '',
        strategy.imageUrl || null,
        strategy.details || '',
        strategy.performance || 0,
        strategy.riskLevel || 'Medium',
        strategy.category || 'Value',
        JSON.stringify(mergedParameters),
        JSON.stringify(strategy.planPrices || {}),
        JSON.stringify(strategy.planDetails || {}),
        strategy.roi !== undefined && strategy.roi !== null ? strategy.roi : null,
        strategy.profit !== undefined && strategy.profit !== null ? strategy.profit : null,
        strategy.maxDdi !== undefined && strategy.maxDdi !== null ? strategy.maxDdi : null,
        strategy.copiers !== undefined && strategy.copiers !== null ? strategy.copiers : null,
        strategy.minCapital !== undefined && strategy.minCapital !== null ? strategy.minCapital : null,
        strategy.avgDrawdown !== undefined && strategy.avgDrawdown !== null ? strategy.avgDrawdown : null,
        strategy.riskReward !== undefined && strategy.riskReward !== null ? strategy.riskReward : null,
        strategy.winStreak !== undefined && strategy.winStreak !== null ? strategy.winStreak : null,
        strategy.tag || null,
        strategy.mastersTag || null,
        strategy.enabled !== undefined ? (strategy.enabled ? 1 : 0) : 1,
        strategy.masterAccountId || null,
        strategy.masterAccountPassword || null,
        strategy.masterAccountServer || null,
        strategy.masterPlatform || 'MT5',
      ]
    );
    return { success: true, id };
  } catch (error: any) {
    console.error('createStrategy failed:', error);
    return { success: false, error: error.message };
  }
};

export const deleteStrategy = async (id: string) => {
  try {
    await pool.execute('DELETE FROM strategies WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('deleteStrategy failed:', error);
    return false;
  }
};

export const registerUser = createUser;

export const updateUserAdmin = async (id: string, updates: any) => {
  try {
    const fields = [];
    const values = [];
    if (updates.name) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.email) { fields.push('email = ?'); values.push(updates.email.toLowerCase()); }
    if (updates.role) { fields.push('role = ?'); values.push(updates.role); }
    if (updates.country) { fields.push('country = ?'); values.push(updates.country); }
    
    if (fields.length === 0) return true;
    values.push(id);
    await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    return true;
  } catch (error) {
    console.error('updateUserAdmin failed:', error);
    return false;
  }
};

export const deleteUserAdmin = async (id: string) => {
  try {
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    return true;
  } catch (error) {
    console.error('deleteUserAdmin failed:', error);
    return false;
  }
};

export const createUserAdmin = async (user: any) => {
  return createUser(user.name, user.email, user.password);
};

export const getPendingTransactions = async () => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM wallet_transactions WHERE status = "pending"');
    return rows;
  } catch (error) {
    console.error('getPendingTransactions failed:', error);
    return [];
  }
};

export const updateUserTokens = async (userId: string, tokens: number) => {
  // Assuming tokens are related to wallet balance or a specific field
  // For now, let's skip or implement if we find the field in SQL
  return true;
};

export const sendEmailNotification = async (to: string, subject: string, body: string) => {
  console.log(`[Email Mock] To: ${to}, Subject: ${subject}`);
  return true;
};

export const syncJsonToMysql = async () => {
  return { success: true, message: 'Sync not implemented yet' };
};

export const getAllTransactions = async () => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM wallet_transactions ORDER BY created_at DESC');
    return rows;
  } catch (error) {
    console.error('Error getting all transactions:', error);
    return [];
  }
};

export const createRunningStrategy = async (userId: string, strategyId: string, plan: string, capital: number, lotSize: number, slaveDetails: any) => {
  try {
    console.log('[dbService.createRunningStrategy] Starting for user:', userId, 'strategy:', strategyId, 'capital:', capital, 'lotSize:', lotSize);

    // Create a new running_strategy row for fresh subscription
    const id = `rs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log('[dbService.createRunningStrategy] Creating new running strategy:', id);

    // Make insert schema-safe for environments where some columns (e.g. lot_size) may not exist yet.
    const [columns]: any = await pool.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'running_strategies'
      ORDER BY ORDINAL_POSITION
    `);
    const availableColumns = Array.isArray(columns) ? columns.map((row: any) => row.COLUMN_NAME) : [];

    const insertData: Record<string, any> = {
      id,
      user_id: userId,
      strategy_id: strategyId,
      plan,
      capital,
      lot_size: lotSize,
      // Some older schemas may use camelCase for lot size; support both.
      lotSize: lotSize,
      status: 'in-process',
      admin_status: 'in-process',
      platform: slaveDetails?.platform || 'MT5',
      mt_account_id: slaveDetails?.mt_account_id || null,
      mt_account_password: slaveDetails?.mt_account_password || null,
      mt_account_server: slaveDetails?.mt_account_server || null,
    };

    const validEntries = Object.entries(insertData).filter(
      ([key, value]) => availableColumns.includes(key) && value !== undefined
    );
    if (validEntries.length === 0) {
      throw new Error('No compatible columns found in running_strategies');
    }

    const finalFields = validEntries.map(([key]) => key);
    const finalValues = validEntries.map(([, value]) => value);
    const placeholders = finalFields.map(() => '?').join(', ');

    const [insertResult]: any = await pool.execute(
      `INSERT INTO running_strategies (${finalFields.join(', ')}) VALUES (${placeholders})`,
      finalValues
    );

    console.log('[dbService.createRunningStrategy] Insert result:', insertResult);

    const [verifyRows]: any = await pool.execute(
      'SELECT id, user_id, strategy_id, status, admin_status FROM running_strategies WHERE id = ?',
      [id]
    );
    console.log('[dbService.createRunningStrategy] Verified after insert:', verifyRows[0] || 'NOT FOUND');

    return { success: true, id };
  } catch (error: any) {
    console.error('[dbService.createRunningStrategy] Error:', error.message || error);
    return { success: false, error: error.message || String(error) };
  }
};

export const updateTransactionStatus = async (id: string, status: string, adminId: string) => {
  try {
    await pool.execute('UPDATE wallet_transactions SET status = ?, admin_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, adminId, id]);
    // Fetch and return the updated transaction
    const transaction = await getTransactionById(id);
    return { success: true, transaction };
  } catch (error: any) {
    console.error('updateTransactionStatus failed:', error);
    return { success: false, error: error.message };
  }
};

export const getRunningStrategiesAdmin = async (): Promise<any[]> => {
  try {
    let query = `
      SELECT rs.*, u.name as user_name, u.email as user_email, s.name as strategy_name
      FROM running_strategies rs
      LEFT JOIN users u ON rs.user_id = u.id
      LEFT JOIN strategies s ON rs.strategy_id = s.id
    `;
    
    try {
      // Check if deleted_at column exists
      await pool.execute('SELECT deleted_at FROM running_strategies LIMIT 1');
      query += ' WHERE rs.deleted_at IS NULL';
    } catch (e) {
      console.warn('[dbService] deleted_at column might not exist yet, skipping filter in admin view');
    }

    query += ' ORDER BY rs.created_at DESC';

    const [rows]: any = await pool.execute(query);
    return rows.map((r: any) => ({
      ...r,
      id: r.id,
      userId: r.user_id,
      userName: r.user_name || 'Unknown',
      userEmail: r.user_email || '',
      strategyId: r.strategy_id,
      strategyName: r.strategy_name || 'Unknown',
      adminStatus: r.admin_status || r.adminStatus || 'in-process',
      mtAccountId: r.mt_account_id,
      mtAccountServer: r.mt_account_server,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  } catch (error) {
    console.error('Error getting admin running strategies:', error);
    return [];
  }
};

export const getProfitSharingUserSummaryAdmin = async (): Promise<any[]> => {
  await ensureProfitSharingTables();
  try {
    const [rows]: any = await pool.execute(`
      SELECT
        psi.user_id,
        COALESCE(MAX(psi.user_name), '') AS user_name,
        COALESCE(MAX(psi.user_email), '') AS user_email,
        COALESCE(SUM(psi.invested_amount), 0) AS total_invested,
        COALESCE(SUM(psi.gross_profit), 0) AS total_profit,
        COALESCE(SUM(psi.swap_amount), 0) AS total_swap,
        COALESCE(SUM(psi.commission_amount), 0) AS total_commission,
        COALESCE(SUM(psi.withdrawal_amount), 0) AS total_withdrawal,
        COALESCE(SUM(psi.settled_balance), 0) AS total_settled_balance,
        COUNT(DISTINCT psi.settlement_id) AS settlements_count,
        MAX(psi.created_at) AS last_settlement_at
      FROM profit_settlement_items psi
      GROUP BY psi.user_id
      ORDER BY last_settlement_at DESC
    `);

    return rows.map((r: any) => ({
      userId: r.user_id,
      userName: r.user_name || 'Unknown',
      userEmail: r.user_email || '',
      totalInvested: Number(r.total_invested || 0),
      totalProfit: Number(r.total_profit || 0),
      totalSwap: Number(r.total_swap || 0),
      totalCommission: Number(r.total_commission || 0),
      totalWithdrawal: Number(r.total_withdrawal || 0),
      totalSettledBalance: Number(r.total_settled_balance || 0),
      settlementsCount: Number(r.settlements_count || 0),
      lastSettlementAt: r.last_settlement_at,
    }));
  } catch (error) {
    console.error('getProfitSharingUserSummaryAdmin failed:', error);
    return [];
  }
};

export const getTransactionById = async (id: string) => {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM wallet_transactions WHERE id = ?', [id]);
    return rows[0] || null;
  } catch (error) {
    console.error('Error getting transaction by ID:', error);
    return null;
  }
};

export const getProfitSharingOverviewAdmin = async (): Promise<any[]> => {
  try {
    const strategies = await getAllStrategies();
    const overview = [];

    for (const s of strategies) {
      const [closedTrades]: any = await pool.execute(
        'SELECT SUM(profit) as total_profit, SUM(swap) as total_swap FROM master_trades_cache WHERE master_id = ? AND is_open = 0',
        [s.master_account_id]
      );
      
      const [lastSettlement]: any = await pool.execute(
        'SELECT settlement_end FROM profit_settlements WHERE strategy_id = ? ORDER BY settlement_end DESC LIMIT 1',
        [s.id]
      );

      const [activeUsers]: any = await pool.execute(
        'SELECT COUNT(*) as count FROM running_strategies WHERE strategy_id = ? AND (status = "active" OR admin_status = "running")',
        [s.id]
      );

      const [openTradesCountResult]: any = await pool.execute(
        'SELECT COUNT(*) as count FROM master_trades_cache WHERE master_id = ? AND is_open = 1',
        [s.master_account_id]
      );

      const [depositRows]: any = await pool.execute(
        'SELECT SUM(capital) as total_deposit FROM running_strategies WHERE strategy_id = ? AND (status = "active" OR admin_status = "running")',
        [s.id]
      );

      const totalDeposit = Number(depositRows[0]?.total_deposit || 0);

      overview.push({
        id: s.id,
        strategyId: s.id,
        strategyName: s.name || 'Unknown',
        strategyCreatedAt: s.created_at || null,
        copiersCount: activeUsers[0]?.count || 0,
        totalDeposit: totalDeposit,
        totalProfit: Number(closedTrades[0]?.total_profit || 0),
        totalSwap: Number(closedTrades[0]?.total_swap || 0),
        openTrades: Number(openTradesCountResult[0]?.count || 0),
        commissionPercent: parseCommissionPercent(s),
        lastSettlementAt: lastSettlement[0]?.settlement_end || null,
      });
    }
    return overview;
  } catch (error) {
    console.error('getProfitSharingOverviewAdmin failed:', error);
    return [];
  }
};

const parseCommissionPercent = (strategy: any): number => {
  const p = strategy.parameters || {};
  const val = p.commission ?? p.Commission;
  if (val == null) return 10; // Default to 10% as per latest requirement
  if (typeof val === 'number') return val;
  const m = String(val).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 10;
};

export const runProfitSettlement = async (strategyId: string, adminId: string, userId?: string) => {
  await ensureProfitSharingTables();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [stratRows]: any = await connection.execute('SELECT * FROM strategies WHERE id = ?', [strategyId]);
    if (stratRows.length === 0) throw new Error('Strategy not found');
    const strategy = stratRows[0];
    strategy.parameters = typeof strategy.parameters === 'string' ? JSON.parse(strategy.parameters || '{}') : strategy.parameters;

    const [lastSettlement]: any = await connection.execute(
      'SELECT settlement_end FROM profit_settlements WHERE strategy_id = ? ORDER BY settlement_end DESC LIMIT 1',
      [strategyId]
    );

    // Get user-specific last settlement if userId is provided
    let userLastSettlementEnd = null;
    if (userId) {
      const [userLastItem]: any = await connection.execute(
        `SELECT ps.settlement_end 
         FROM profit_settlement_items psi
         JOIN profit_settlements ps ON psi.settlement_id = ps.id
         WHERE psi.user_id = ? AND psi.strategy_id = ?
         ORDER BY ps.settlement_end DESC LIMIT 1`,
        [userId, strategyId]
      );
      userLastSettlementEnd = userLastItem[0]?.settlement_end;
    }

    // IMPORTANT: Even if settling for one user, we need to know the total capital of ALL active users 
    // to correctly calculate the profit share for that user.
    const allUsersQuery = `SELECT rs.id as rs_id, rs.user_id, u.name, u.email, rs.capital, rs.status, rs.admin_status, rs.created_at
         FROM running_strategies rs
         JOIN users u ON rs.user_id = u.id
         WHERE rs.strategy_id = ?`;
    
    const [allUsersRows]: any = await connection.execute(allUsersQuery, [strategyId]);

    if (!Array.isArray(allUsersRows) || allUsersRows.length === 0) {
      throw new Error('No users found for this strategy.');
    }

    // Filter target users (usually just one if userId is provided)
    const targetUsers = userId 
      ? allUsersRows.filter((u: any) => u.user_id === userId) 
      : allUsersRows.filter((u: any) => u.status === "active" || u.admin_status === "running");

    if (userId && targetUsers.length === 0) {
      throw new Error('User not found in this strategy records.');
    }

    // Settlement start logic:
    // 1. If user-specific, start from their last settlement OR their strategy start date
    // 2. If strategy-wide, start from last strategy settlement OR the strategy creation date
    let settlementStart = userId 
      ? (userLastSettlementEnd || targetUsers[0]?.created_at || strategy.created_at) 
      : (lastSettlement[0]?.settlement_end || strategy.created_at);
    
    // Ensure settlementStart is not in the future compared to settlementEnd
    const settlementEnd = new Date();
    if (new Date(settlementStart) > settlementEnd) {
      settlementStart = strategy.created_at; // Fallback
    }

    // NEW: Check if there are any open trades for this strategy's master account.
    // If there are open trades, settlement is NOT allowed for active users.
    const [openTrades]: any = await connection.execute(
      `SELECT COUNT(*) as count FROM master_trades_cache 
       WHERE master_id = ? AND is_open = 1`,
      [strategy.master_account_id]
    );

    if (openTrades[0].count > 0) {
      // If we are settling a specific user, only block if they are still active.
      // If they are already disconnected/stopped, they have no more open trades to wait for.
      if (userId) {
        const u = targetUsers[0];
        if (u.status === "active" || u.admin_status === "running") {
          await connection.rollback();
          return { 
            success: false, 
            error: `Cannot run settlement: User is still active and there are ${openTrades[0].count} open trades for this strategy. Please disconnect the user or wait for trades to close.` 
          };
        }
      } else {
        await connection.rollback();
        return { 
          success: false, 
          error: `Cannot run settlement: There are ${openTrades[0].count} open trades for this strategy. All trades must be closed before strategy-wide settlement.` 
        };
      }
    }

    const [closedTrades]: any = await connection.execute(
      `SELECT COUNT(*) as count, SUM(profit) as total_profit, SUM(swap) as total_swap 
       FROM master_trades_cache 
       WHERE master_id = ? AND is_open = 0 AND time_close > ? AND time_close <= ?`,
      [strategy.master_account_id, settlementStart, settlementEnd]
    );

    const totalProfit = Number(closedTrades[0]?.total_profit || 0);
    const totalSwap = Number(closedTrades[0]?.total_swap || 0);
    const tradesCount = Number(closedTrades[0]?.count || 0);

    // If it's a general strategy-wide settlement, we might want to skip if no trades or no profit.
    // However, we should at least allow it if there are trades, even if negative, to mark them as settled.
    if (!userId && tradesCount === 0) {
      await connection.rollback();
      return { success: true, message: 'No trades found to settle at this time.', settlementId: null };
    }

    // Calculate total deposit of all CURRENTLY active users to determine shares
    // This ensures that profit is shared correctly among all participants.
    const activeUsers = allUsersRows.filter((u: any) => u.status === "active" || u.admin_status === "running" || (userId && u.user_id === userId));
    
    let totalDeposit = 0;
    for (const u of activeUsers) {
      if (Number(u.capital) > 0) {
        totalDeposit += Number(u.capital);
      } else {
        const [depRows]: any = await connection.execute(
          'SELECT SUM(amount) as invested FROM wallet_transactions WHERE user_id = ? AND strategy_id = ? AND transaction_type = "deposit" AND status IN ("completed", "approved", "settled")',
          [u.user_id, strategyId]
        );
        totalDeposit += Number(depRows[0]?.invested || 0);
      }
    }

    if (totalDeposit <= 0) throw new Error('No active investment found for settlement.');

    const settlementId = `ps_${Date.now()}`;
    const commissionPercent = parseCommissionPercent(strategy);

    let settledTotalProfit = 0;
    let settledTotalCommission = 0;
    let settledTotalWithdrawal = 0;
    let settledTotalSwap = 0;
    const settledItems: any[] = [];

    for (const u of targetUsers) {
      let invested = Number(u.capital || 0);
      if (invested <= 0) {
        // Fallback to wallet_transactions if capital is not set in running_strategies
        const [depRows]: any = await connection.execute(
          'SELECT SUM(amount) as invested FROM wallet_transactions WHERE user_id = ? AND strategy_id = ? AND transaction_type = "deposit" AND status IN ("completed", "approved", "settled")',
          [u.user_id, strategyId]
        );
        invested = Number(depRows[0]?.invested || 0);
      }
      
      const share = totalDeposit > 0 ? invested / totalDeposit : 0;
      const userGrossProfit = totalProfit * share;
      const userSwap = totalSwap * share;

      // Formula: Commission = Profit * commissionPercent
      // System should always use same formula, even for a single trade.
      const commission = userGrossProfit > 0 ? (userGrossProfit * commissionPercent / 100) : 0;
      
      // The amount to be withdrawn to the central wallet is the profit AFTER commission.
      // We only withdraw if there is actual profit. Losses remain in the strategy capital.
      const withdrawal = Math.max(0, userGrossProfit - commission);
      
      // The final balance for the user in this strategy after settlement.
      // Note: If there is a loss (userGrossProfit < 0), settledBalance will correctly be less than invested.
      const settledBalance = invested + userGrossProfit + userSwap - commission;

      // Only skip if the settledBalance is 0 or less AND it's not a user-specific settlement
      if (settledBalance <= 0 && !userId) continue;

      const item = {
        id: `psi_${uuidv4()}`, settlement_id: settlementId, strategy_id: strategyId, user_id: u.user_id, user_name: u.name, user_email: u.email,
        invested_amount: invested, gross_profit: userGrossProfit, swap_amount: userSwap, commission_amount: commission, withdrawal_amount: withdrawal, settled_balance: settledBalance,
      };

      await connection.execute(
        `INSERT INTO profit_settlement_items (
          id, settlement_id, strategy_id, user_id, user_name, user_email,
          invested_amount, gross_profit, swap_amount, commission_amount, withdrawal_amount, settled_balance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id, item.settlement_id, item.strategy_id, item.user_id, item.user_name, item.user_email,
          item.invested_amount, item.gross_profit, item.swap_amount, item.commission_amount, item.withdrawal_amount, item.settled_balance,
        ]
      );

      // Update the user's running capital to the new settled balance
      // This ensures the baseline is correct for the next settlement cycle.
      await connection.execute(
        'UPDATE running_strategies SET capital = ?, updated_at = NOW() WHERE user_id = ? AND strategy_id = ?',
        [settledBalance, u.user_id, strategyId]
      );

      // NEW: Record the commission deduction in wallet_transactions for transparency
      if (commission > 0) {
        await connection.execute(
          `INSERT INTO wallet_transactions (
            id, user_id, strategy_id, running_strategy_id, amount, transaction_type, status, admin_message, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            `txn_comm_${uuidv4()}`, u.user_id, strategyId, u.rs_id, commission, 'commission', 'completed', `Settled Commission for strategy ${strategy.name}`
          ]
        );
      }

      settledTotalProfit += userGrossProfit;
      settledTotalCommission += commission;
      settledTotalWithdrawal += withdrawal;
      settledTotalSwap += userSwap;
      settledItems.push(item);
    }

    if (settledItems.length === 0) {
      await connection.rollback();
      return { success: true, message: 'No profit to settle for the selected user(s) at this time.', settlementId: null, items: [] };
    }

    await connection.execute(
      `INSERT INTO profit_settlements (
        id, strategy_id, settlement_start, settlement_end, total_profit,
        total_commission, total_withdrawal, total_swap, users_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        settlementId, strategyId, settlementStart, settlementEnd,
        settledTotalProfit, settledTotalCommission, settledTotalWithdrawal, settledTotalSwap, targetUsers.length,
      ]
    );

    const settlement = {
      id: settlementId,
      strategy_id: strategyId,
      settlement_start: settlementStart,
      settlement_end: settlementEnd,
      total_profit: settledTotalProfit,
      total_commission: settledTotalCommission,
      total_withdrawal: settledTotalWithdrawal,
      total_swap: settledTotalSwap,
      users_count: targetUsers.length,
    };

    await connection.commit();
    return { success: true, settlementId, settlement, items: settledItems };
  } catch (error: any) {
    await connection.rollback();
    console.error('runProfitSettlement failed:', error);
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
};

export const runProfitSharingSettlementAdmin = runProfitSettlement;
