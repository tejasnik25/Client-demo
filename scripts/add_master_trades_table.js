const mysql = require('mysql2/promise');
require('dotenv').config();

async function addMasterTradesTable() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'admin',
      database: process.env.DB_NAME || 'stock_analysis_db',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 2,
      idleTimeout: 30000,
      queueLimit: 0,
      connectTimeout: 20000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });

    console.log('Connecting to database...');
    
    // Create the master_trades table
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('master_trades table created successfully!');
    
    // Verify the table exists
    const [rows] = await pool.execute('SHOW TABLES LIKE "master_trades"');
    if (rows.length > 0) {
      console.log('✅ Verification: master_trades table exists');
    } else {
      console.log('❌ Verification failed: master_trades table not found');
    }

    await pool.end();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error creating master_trades table:', error);
    process.exit(1);
  }
}

addMasterTradesTable();
