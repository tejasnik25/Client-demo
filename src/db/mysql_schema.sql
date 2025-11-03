-- MySQL Database Schema for Stock Analysis App

CREATE DATABASE IF NOT EXISTS stock_analysis_db;
USE stock_analysis_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL, -- In production, this should be hashed
  wallet_balance DECIMAL(10, 2) DEFAULT 0.00,
  role ENUM('USER', 'ADMIN') DEFAULT 'USER',
  email_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
  -- New fields for INR and USDT details
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
);


-- Insert test user
INSERT INTO users (id, name, email, password, wallet_balance, email_verified)
VALUES ('user123', 'Test User', 'test@example.com', 'password123', 100.00, TRUE);