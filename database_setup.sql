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
  wallet_balance DECIMAL(10, 2) DEFAULT 0.00,
  role ENUM('USER', 'ADMIN') DEFAULT 'USER',
  email_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  stock_analysis_access BOOLEAN DEFAULT FALSE,
  analysis_count INT DEFAULT 0,
  trial_expiry DATETIME NULL
);

-- Wallet Transactions Table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  transaction_type ENUM('deposit', 'charge') NOT NULL,
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
  status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  rejection_reason TEXT,
  admin_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

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
  content_type VARCHAR(16),
  content_url VARCHAR(500),
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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
