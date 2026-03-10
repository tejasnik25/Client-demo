// Migration script to add swap field to master_trades_cache table
const mysql = require('mysql2/promise');
require('dotenv').config();

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
  ssl: process.env.VERCEL || process.env.DB_SSL ? { rejectUnauthorized: false } : undefined
});

async function addSwapField() {
  try {
    console.log('Adding swap field to master_trades_cache table...');
    
    // Add swap column if it doesn't exist
    try {
      await pool.execute(`
        ALTER TABLE master_trades_cache 
        ADD COLUMN swap DECIMAL(18,2) DEFAULT 0
      `);
      console.log('✓ swap field added to master_trades_cache table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ swap field already exists in master_trades_cache table');
      } else {
        throw error;
      }
    }

    // Also add to master_trades table if it doesn't exist
    try {
      await pool.execute(`
        ALTER TABLE master_trades 
        ADD COLUMN swap DECIMAL(18,2) DEFAULT 0
      `);
      console.log('✓ swap field added to master_trades table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ swap field already exists in master_trades table');
      } else {
        console.warn('Could not add swap to master_trades table:', error.message);
      }
    }

    // Also add to trades table if it doesn't exist
    try {
      await pool.execute(`
        ALTER TABLE trades 
        ADD COLUMN swap DECIMAL(18,2) DEFAULT 0
      `);
      console.log('✓ swap field added to trades table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ swap field already exists in trades table');
      } else {
        console.warn('Could not add swap to trades table:', error.message);
      }
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

addSwapField();
