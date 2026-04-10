const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'admin',
  database: 'stock_analysis_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function verify() {
  try {
    const conn = await pool.getConnection();
    
    console.log('\n=== USER EXISTS IN USERS TABLE? ===');
    const [user] = await conn.query(
      `SELECT id, email, created_at FROM users WHERE id = ?`,
      ['user_1772105441338']
    );
    console.log('User Record:', user);
    
    console.log('\n=== ALL RUNNING STRATEGIES FOR THIS USER (ANY STRATEGY) ===');
    const [allRS] = await conn.query(
      `SELECT id, user_id, strategy_id, lot_size, status FROM running_strategies 
       WHERE user_id = ?`,
      ['user_1772105441338']
    );
    console.log('All Running Strategies:', allRS);
    
    console.log('\n=== ALL WALLET TRANSACTIONS FOR THIS USER (ANY STRATEGY) ===');
    const [allWT] = await conn.query(
      `SELECT id, user_id, strategy_id, lot_size, amount, status FROM wallet_transactions 
       WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 10`,
      ['user_1772105441338']
    );
    console.log('All Wallet Transactions:', allWT);
    
    console.log('\n=== PROFIT_SETTLEMENTS TABLE SCHEMA ===');
    const [schema] = await conn.query(`DESCRIBE profit_settlements`);
    console.log('Schema:', schema);
    
    console.log('\n=== HOW TO CREATE RUNNING STRATEGY (FOR REFERENCE) ===');
    console.log('Strategy-1 exists: checking...');
    const [strat] = await conn.query(`SELECT id, name FROM strategies WHERE id = 'strategy-1'`);
    console.log('Strategy:', strat);
    
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

verify();
