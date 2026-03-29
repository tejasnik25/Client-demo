-- Complete MySQL Database Setup for Stock Analysis App
-- Run this script in your MySQL provider's console or via command line

-- Create Database
CREATE DATABASE IF NOT EXISTS stock_analysis_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stock_analysis_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(32),
  country_code VARCHAR(8),
  country VARCHAR(100),
  wallet_balance DECIMAL(10, 2) DEFAULT 0.00,
  role ENUM('USER', 'ADMIN') DEFAULT 'USER',
  email_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  stock_analysis_access BOOLEAN DEFAULT FALSE,
  analysis_count INT DEFAULT 0,
  trial_expiry DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Idempotent index creation for users(role, created_at)
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_role_created'
);
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE users ADD INDEX idx_users_role_created (role, created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Wallet Transactions Table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  transaction_type ENUM('deposit', 'charge', 'withdrawal', 'commission', 'swap', 'settled') NOT NULL,
  payment_method VARCHAR(50),
  transaction_id VARCHAR(100),
  receipt_path VARCHAR(255),
  platform ENUM('MT4', 'MT5'),
  mt_account_id VARCHAR(255),
  mt_account_password VARCHAR(255),
  terms_accepted BOOLEAN DEFAULT FALSE,
  strategy_id VARCHAR(255),
  plan_level ENUM('Premium','Expert','Pro'),
  inr_amount DECIMAL(12, 2),
  inr_to_usd_rate DECIMAL(12, 6),
  crypto_network ENUM('ERC20','TRC20'),
  crypto_wallet_address VARCHAR(128),
  wallet_app_deeplink VARCHAR(255),
  status ENUM('pending','in-process','completed','failed','settled') DEFAULT 'pending',
  rejection_reason TEXT,
  admin_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Idempotent indexes for wallet_transactions
SET @i1 := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_transactions' AND INDEX_NAME = 'idx_wallet_user_status_created'
);
SET @ddl := IF(@i1 = 0,
  'ALTER TABLE wallet_transactions ADD INDEX idx_wallet_user_status_created (user_id, status, created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i2 := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_transactions' AND INDEX_NAME = 'idx_wallet_txid'
);
SET @ddl := IF(@i2 = 0,
  'ALTER TABLE wallet_transactions ADD INDEX idx_wallet_txid (transaction_id)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Analysis History Table
CREATE TABLE IF NOT EXISTS analysis_history (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(64),
  analysis TEXT,
  score DECIMAL(6,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_analysis_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Strategies Table
CREATE TABLE IF NOT EXISTS strategies (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  performance INT DEFAULT 0,
  risk_level ENUM('Low','Medium','High') DEFAULT 'Medium',
  category ENUM('Growth','Income','Momentum','Value') DEFAULT 'Growth',
  image_url VARCHAR(500),
  details TEXT,
  parameters JSON,
  -- Pricing and display metadata
  plan_prices JSON,
  plan_details JSON,
  -- Metrics
  min_capital DECIMAL(14,2),
  avg_drawdown DECIMAL(8,2),
  risk_reward DECIMAL(8,2),
  win_streak INT,
  tag VARCHAR(255),
  masters_tag VARCHAR(255),
  -- Content metadata and storage
  content_type VARCHAR(16),
  content_url TEXT,
  content_blob LONGBLOB,
  content_mime VARCHAR(255),
  content_s3_key VARCHAR(512),
  -- New metrics and icon storage
  roi DECIMAL(10, 2),
  profit DECIMAL(10, 2),
  max_ddi DECIMAL(10, 2),
  copiers INT,
  icon_blob LONGBLOB,
  icon_mime VARCHAR(255),
  enabled BOOLEAN DEFAULT TRUE,
  -- Master Account Details
  master_account_id VARCHAR(255),
  master_account_password VARCHAR(255),
  master_account_server VARCHAR(255),
  master_platform ENUM('MT4', 'MT5'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Idempotent indexes for strategies
SET @s1 := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND INDEX_NAME = 'idx_strategies_enabled_category'
);
SET @ddl := IF(@s1 = 0,
  'ALTER TABLE strategies ADD INDEX idx_strategies_enabled_category (enabled, category)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s2 := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND INDEX_NAME = 'idx_strategies_risk'
);
SET @ddl := IF(@s2 = 0,
  'ALTER TABLE strategies ADD INDEX idx_strategies_risk (risk_level)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Payments Table (admin payments module)
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  strategyId VARCHAR(255) NOT NULL,
  plan ENUM('Pro', 'Expert', 'Premium') NOT NULL,
  capital DECIMAL(10, 2) NOT NULL,
  payable DECIMAL(10, 2) NOT NULL,
  method ENUM('USDT_ERC20', 'USDT_TRC20', 'UPI') NOT NULL,
  txId VARCHAR(255) NOT NULL,
  proofUrl VARCHAR(512) NOT NULL,
  mt4mt5 JSON NOT NULL,
  status ENUM('pending','in_process','approved','failed','renewal_pending','renewal_approved','rejected') DEFAULT 'pending',
  approvedAt DATETIME NULL,
  verifiedBy VARCHAR(255) NULL,
  rejection_reason TEXT NULL,
  expiresAt DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (strategyId) REFERENCES strategies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Idempotent indexes for payments
SET @p1 := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'idx_payments_user_status_created'
);
SET @ddl := IF(@p1 = 0,
  'ALTER TABLE payments ADD INDEX idx_payments_user_status_created (userId, status, created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @p2 := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'idx_payments_strategy_plan'
);
SET @ddl := IF(@p2 = 0,
  'ALTER TABLE payments ADD INDEX idx_payments_strategy_plan (strategyId, plan)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @p3 := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND INDEX_NAME = 'idx_payments_txid'
);
SET @ddl := IF(@p3 = 0,
  'ALTER TABLE payments ADD INDEX idx_payments_txid (txId)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Running Strategies Table
CREATE TABLE IF NOT EXISTS running_strategies (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  strategy_id VARCHAR(255) NOT NULL,
  plan ENUM('Pro', 'Expert', 'Premium') NOT NULL,
  capital DECIMAL(10, 2) NOT NULL,
  status ENUM('in-process', 'active', 'stopped') DEFAULT 'in-process',
  admin_status ENUM('in-process','wrong-account-password','wrong-account-id','wrong-account-server-name','running','disconnected') DEFAULT 'in-process',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Idempotent index for running_strategies
SET @rs1 := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'running_strategies' AND INDEX_NAME = 'idx_running_user_status'
);
SET @ddl := IF(@rs1 = 0,
  'ALTER TABLE running_strategies ADD INDEX idx_running_user_status (user_id, status)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Running Strategy Modifications Table
CREATE TABLE IF NOT EXISTS running_strategy_modifications (
  id VARCHAR(255) PRIMARY KEY,
  running_strategy_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  status ENUM('in-process', 'approved', 'rejected') DEFAULT 'in-process',
  new_update_json JSON,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (running_strategy_id) REFERENCES running_strategies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Trades Cache Table (Temporary Storage for Real-time Trades)
CREATE TABLE IF NOT EXISTS master_trades_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  master_id VARCHAR(255) NOT NULL,
  position_id VARCHAR(255) NOT NULL,
  time_open TIMESTAMP NULL,
  time_close TIMESTAMP NULL,
  server_time_open VARCHAR(64),
  server_time_close VARCHAR(64),
  symbol VARCHAR(64),
  type VARCHAR(32),
  volume DECIMAL(14, 2),
  price_open DECIMAL(14, 5),
  price_close DECIMAL(14, 5),
  profit DECIMAL(14, 2),
  is_open BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_master_pos (master_id, position_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Trades Table (Persistent Storage for Master Account Trade History)
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  strategy_id VARCHAR(255) NOT NULL,
  plan ENUM('Pro', 'Expert', 'Premium') NOT NULL,
  capital DECIMAL(10, 2) NOT NULL,
  payable DECIMAL(10, 2) NOT NULL,
  method ENUM('USDT_ERC20', 'USDT_TRC20', 'UPI') NOT NULL,
  mt4mt5 JSON NOT NULL,
  status ENUM('pending', 'completed', 'failed', 'cancelled', 'timeout') DEFAULT 'pending',
  error_message VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Idempotent index for payment_transactions
SET @pt1 := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transactions' AND INDEX_NAME = 'idx_payment_tx_user_status'
);
SET @ddl := IF(@pt1 = 0,
  'ALTER TABLE payment_transactions ADD INDEX idx_payment_tx_user_status (user_id, status, created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Plan Usage Report Table (used by /api/plan-usage)
CREATE TABLE IF NOT EXISTS plan_usage_report (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  strategyId VARCHAR(255) NOT NULL,
  plan ENUM('Pro', 'Expert', 'Premium') NOT NULL,
  capital DECIMAL(10, 2) NOT NULL,
  payable DECIMAL(10, 2) NOT NULL,
  method ENUM('USDT_ERC20', 'USDT_TRC20', 'UPI') NOT NULL,
  payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('in-process', 'active') NOT NULL DEFAULT 'in-process',
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (strategyId) REFERENCES strategies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Idempotent index for plan_usage_report
SET @pur1 := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plan_usage_report' AND INDEX_NAME = 'idx_plan_usage_user_status'
);
SET @ddl := IF(@pur1 = 0,
  'ALTER TABLE plan_usage_report ADD INDEX idx_plan_usage_user_status (userId, status, payment_date)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Seed Admin User (password: admin123)
INSERT INTO users (id, name, email, password, role, email_verified, wallet_balance) 
VALUES ('admin123', 'Admin User', 'admin@stockanalysis.com', '$2b$12$CNEH75BtbiEtjc76Kdvv6.67nJ/aF4uAEc5znGg3CN.lH3JN6nGXq', 'ADMIN', TRUE, 0.00)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Seed Test User (password: userpass123 - hash this in production!)
INSERT INTO users (id, name, email, password, wallet_balance, email_verified) 
VALUES ('user123', 'Test User', 'test@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx/2jzmK', 100.00, TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Sample Strategies
INSERT INTO strategies (id, name, description, performance, risk_level, category, enabled) VALUES
('strategy-1', 'Growth Momentum', 'High-growth stocks with strong momentum indicators', 85, 'High', 'Growth', TRUE),
('strategy-2', 'Value Income', 'Undervalued dividend-paying stocks', 72, 'Low', 'Income', TRUE),
('strategy-3', 'Tech Innovation', 'Technology sector focus with innovation metrics', 91, 'Medium', 'Growth', TRUE),
('strategy-4', 'Defensive Value', 'Conservative value plays in stable sectors', 68, 'Low', 'Value', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Verify setup
SELECT 'Database setup completed successfully!' as status;
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as strategy_count FROM strategies;
ALTER TABLE payments MODIFY COLUMN status ENUM('pending','in_process','approved','failed','renewal_pending','renewal_approved','rejected') DEFAULT 'pending';

-- Backward-compatible column additions for existing databases (AWS RDS safe)
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone'
);
SET @ddl := IF(@exists = 0,
  'ALTER TABLE users ADD COLUMN phone VARCHAR(32) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'country_code'
);
SET @ddl := IF(@exists = 0,
  'ALTER TABLE users ADD COLUMN country_code VARCHAR(8) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'country'
);
SET @ddl := IF(@exists = 0,
  'ALTER TABLE users ADD COLUMN country VARCHAR(100) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backward-compatible column additions for existing databases (AWS RDS safe)
-- approvedAt
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'approvedAt'
);
SET @ddl := IF(@exists = 0,
  'ALTER TABLE payments ADD COLUMN approvedAt DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- verifiedBy
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'verifiedBy'
);
SET @ddl := IF(@exists = 0,
  'ALTER TABLE payments ADD COLUMN verifiedBy VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- rejection_reason
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'rejection_reason'
);
SET @ddl := IF(@exists = 0,
  'ALTER TABLE payments ADD COLUMN rejection_reason TEXT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- expiresAt (add if missing, else ensure NULL allowed)
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'expiresAt'
);
SET @ddl := IF(@exists = 0,
  'ALTER TABLE payments ADD COLUMN expiresAt DATETIME NULL',
  'ALTER TABLE payments MODIFY COLUMN expiresAt DATETIME NULL'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- mt_account_server for wallet_transactions
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_transactions' AND COLUMN_NAME = 'mt_account_server'
);
SET @ddl := IF(@exists = 0,
  'ALTER TABLE wallet_transactions ADD COLUMN mt_account_server VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Update strategies table metrics (replace old with new)
SET @exists_min_capital := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND COLUMN_NAME = 'min_capital'
);
SET @ddl := IF(@exists_min_capital > 0,
  'ALTER TABLE strategies DROP COLUMN min_capital',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists_avg_drawdown := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND COLUMN_NAME = 'avg_drawdown'
);
SET @ddl := IF(@exists_avg_drawdown > 0,
  'ALTER TABLE strategies DROP COLUMN avg_drawdown',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists_risk_reward := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND COLUMN_NAME = 'risk_reward'
);
SET @ddl := IF(@exists_risk_reward > 0,
  'ALTER TABLE strategies DROP COLUMN risk_reward',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists_win_streak := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND COLUMN_NAME = 'win_streak'
);
SET @ddl := IF(@exists_win_streak > 0,
  'ALTER TABLE strategies DROP COLUMN win_streak',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add new metrics columns
SET @exists_roi := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND COLUMN_NAME = 'roi'
);
SET @ddl := IF(@exists_roi = 0,
  'ALTER TABLE strategies ADD COLUMN roi DECIMAL(8,2)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists_profit := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND COLUMN_NAME = 'profit'
);
SET @ddl := IF(@exists_profit = 0,
  'ALTER TABLE strategies ADD COLUMN profit DECIMAL(14,2)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists_max_ddi := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND COLUMN_NAME = 'max_ddi'
);
SET @ddl := IF(@exists_max_ddi = 0,
  'ALTER TABLE strategies ADD COLUMN max_ddi DECIMAL(8,2)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists_copiers := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND COLUMN_NAME = 'copiers'
);
SET @ddl := IF(@exists_copiers = 0,
  'ALTER TABLE strategies ADD COLUMN copiers INT',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists_icon_blob := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND COLUMN_NAME = 'icon_blob'
);
SET @ddl := IF(@exists_icon_blob = 0,
  'ALTER TABLE strategies ADD COLUMN icon_blob LONGBLOB',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists_icon_mime := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND COLUMN_NAME = 'icon_mime'
);
SET @ddl := IF(@exists_icon_mime = 0,
  'ALTER TABLE strategies ADD COLUMN icon_mime VARCHAR(255)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add master account details to strategies
SET @exists_master_id := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND COLUMN_NAME = 'master_account_id'
);
SET @ddl := IF(@exists_master_id = 0,
  'ALTER TABLE strategies ADD COLUMN master_account_id VARCHAR(255)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Disconnect Snapshots Table
CREATE TABLE IF NOT EXISTS disconnect_snapshots (
  id VARCHAR(36) PRIMARY KEY,
  running_strategy_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  snapshot_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  positions JSON NOT NULL,
  FOREIGN KEY (running_strategy_id) REFERENCES running_strategies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @exists_master_pw := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND COLUMN_NAME = 'master_account_password'
);
SET @ddl := IF(@exists_master_pw = 0,
  'ALTER TABLE strategies ADD COLUMN master_account_password VARCHAR(255)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists_master_server := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND COLUMN_NAME = 'master_account_server'
);
SET @ddl := IF(@exists_master_server = 0,
  'ALTER TABLE strategies ADD COLUMN master_account_server VARCHAR(255)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists_master_platform := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'strategies' AND COLUMN_NAME = 'master_platform'
);
SET @ddl := IF(@exists_master_platform = 0,
  'ALTER TABLE strategies ADD COLUMN master_platform ENUM("MT4", "MT5")',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verify master_trades table exists (added for master history functionality)
SET @table_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'master_trades'
);
SET @ddl := IF(@table_exists = 0,
  'CREATE TABLE master_trades (
    id VARCHAR(255) PRIMARY KEY,
    master_id VARCHAR(255) NOT NULL,
    position_id VARCHAR(255) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    type ENUM("BUY", "SELL") NOT NULL,
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
  'SELECT "master_trades table already exists" as status'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Final verification
SELECT 'Database setup completed successfully!' as status;
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as strategy_count FROM strategies;
SELECT COUNT(*) as master_trades_count FROM master_trades;
ALTER TABLE payments MODIFY COLUMN status ENUM('pending','in_process','approved','failed','renewal_pending','renewal_approved','rejected') DEFAULT 'pending';
