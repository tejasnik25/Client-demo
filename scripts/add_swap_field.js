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
    console.log('Adding missing fields to master_trades_cache table...');
    
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

    // Add commission column if it doesn't exist
    try {
      await pool.execute(`
        ALTER TABLE master_trades_cache 
        ADD COLUMN commission DECIMAL(18,2) DEFAULT 0
      `);
      console.log('✓ commission field added to master_trades_cache table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ commission field already exists in master_trades_cache table');
      } else {
        console.warn('Could not add commission to master_trades_cache table:', error.message);
      }
    }

    // Add created_at column if it doesn't exist
    try {
      await pool.execute(`
        ALTER TABLE master_trades_cache 
        ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('✓ created_at field added to master_trades_cache table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ created_at field already exists in master_trades_cache table');
      } else {
        console.warn('Could not add created_at to master_trades_cache table:', error.message);
      }
    }

    // Add id column if it doesn't exist (primary key)
    try {
      await pool.execute(`
        ALTER TABLE master_trades_cache 
        ADD COLUMN id VARCHAR(255) PRIMARY KEY
      `);
      console.log('✓ id field added to master_trades_cache table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ id field already exists in master_trades_cache table');
      } else if (error.code === 'ER_MULTIPLE_PRI_KEY') {
        console.log('✓ primary key already exists in master_trades_cache table');
      } else {
        console.warn('Could not add id to master_trades_cache table:', error.message);
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
      } else if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log('✓ trades table does not exist (expected)');
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
