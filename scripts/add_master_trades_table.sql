-- Add missing master_trades table
USE stock_analysis_db;

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

SELECT 'master_trades table created successfully!' as status;
