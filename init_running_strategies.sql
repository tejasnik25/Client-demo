CREATE TABLE IF NOT EXISTS running_strategies (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  strategy_id VARCHAR(255) NOT NULL,
  plan VARCHAR(50),
  capital DECIMAL(10, 2) DEFAULT 0,
  lot_size DECIMAL(10, 4) DEFAULT 1.0000,
  status VARCHAR(50) DEFAULT 'in-process',
  admin_status VARCHAR(50) DEFAULT 'in-process',
  platform ENUM('MT4', 'MT5'),
  mt_account_id VARCHAR(255),
  mt_account_password VARCHAR(255),
  mt_account_server VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_strategy_id (strategy_id),
  INDEX idx_status (status)
);

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
);

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
);

CREATE TABLE IF NOT EXISTS running_strategy_modifications (
  id VARCHAR(255) PRIMARY KEY,
  running_strategy_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  status ENUM('in-process', 'approved', 'rejected') DEFAULT 'in-process',
  new_update_json JSON,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS disconnect_snapshots (
  id VARCHAR(255) PRIMARY KEY,
  running_strategy_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  positions JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS running_periods (
  id VARCHAR(255) PRIMARY KEY,
  running_strategy_id VARCHAR(255) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_running_strategy_id (running_strategy_id),
  INDEX idx_start_time (start_time),
  INDEX idx_end_time (end_time)
);

ALTER TABLE wallet_transactions ADD COLUMN lot_size DECIMAL(10, 4) NULL AFTER strategy_id;
ALTER TABLE wallet_transactions ADD COLUMN running_strategy_id VARCHAR(255) AFTER lot_size;

SHOW TABLES;
