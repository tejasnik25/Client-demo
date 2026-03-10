
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_NAME || 'stock_analysis_db',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  waitForConnections: true,
  connectionLimit: 1,
  ssl: process.env.VERCEL || process.env.DB_SSL ? { rejectUnauthorized: false } : undefined
});

async function clearTable() {
  try {
    console.log('Attempting to clear master_trades_cache table...');
    await pool.execute('TRUNCATE TABLE master_trades_cache');
    console.log('✅ Table master_trades_cache cleared successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to clear table:', error);
    process.exit(1);
  }
}

clearTable();
