const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  console.log('Testing Database Connection...');
  console.log('Host:', process.env.DB_HOST);
  console.log('User:', process.env.DB_USER);
  
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false }
    });

    // 1. Test Basic Connection
    await pool.query('SELECT 1');
    console.log('✅ Database Connection Successful!');

    // 2. Test Strategies Query
    console.log('Testing Strategies Query...');
    const [strategies] = await pool.query(
      `SELECT id, master_account_id, master_account_password, master_account_server, master_platform 
       FROM strategies 
       WHERE master_account_id IS NOT NULL AND master_account_id != ''`
    );
    console.log(`✅ Found ${strategies.length} strategies with master accounts.`);

    // 3. Test Wallet Transactions Query
    // NOTE: Using snake_case for user_id and strategy_id as per database_setup.sql
    console.log('Testing Wallet Transactions Query...');
    const [transactions] = await pool.query(
      `SELECT id, user_id, strategy_id, mt_account_id, status 
       FROM wallet_transactions 
       WHERE status = 'completed'`
    );
    console.log(`✅ Found ${transactions.length} completed wallet transactions.`);

    pool.end();
  } catch (error) {
    console.error('❌ Connection Failed:', error.message);
  }
}

testConnection();
