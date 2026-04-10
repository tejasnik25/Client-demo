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
    
    console.log('\n=== CHECKING WALLET TRANSACTIONS FOR user_1772105441338 ===');
    const [wt] = await conn.query(
      `SELECT id, user_id, strategy_id, lot_size, amount, status, created_at 
       FROM wallet_transactions 
       WHERE user_id = ? AND strategy_id = 'strategy-1'
       ORDER BY created_at DESC LIMIT 5`,
      ['user_1772105441338']
    );
    console.log('Wallet Transactions:', wt);
    
    console.log('\n=== CHECKING RUNNING_STRATEGIES FOR user_1772105441338 ===');
    const [rs] = await conn.query(
      `SELECT id, user_id, strategy_id, lot_size, status, created_at, updated_at
       FROM running_strategies 
       WHERE user_id = ? AND strategy_id = 'strategy-1'`,
      ['user_1772105441338']
    );
    console.log('Running Strategies:', rs);
    
    console.log('\n=== CHECKING PROFIT_SETTLEMENTS FOR user_1772105441338 ===');
    const [ps] = await conn.query(
      `SELECT ps.id, ps.user_id, ps.strategy_id, ps.profit_amount, ps.status, ps.created_at
       FROM profit_settlements ps
       WHERE ps.user_id = ? AND ps.strategy_id = 'strategy-1'
       ORDER BY ps.created_at DESC LIMIT 5`,
      ['user_1772105441338']
    );
    console.log('Profit Settlements:', ps);
    
    console.log('\n=== CHECKING RUNNING PERIODS FOR user_1772105441338 ===');
    const [rp] = await conn.query(
      `SELECT id, user_id, strategy_id, period_start, period_end, status
       FROM running_periods
       WHERE user_id = ? AND strategy_id = 'strategy-1'
       ORDER BY period_start DESC LIMIT 5`,
      ['user_1772105441338']
    );
    console.log('Running Periods:', rp);
    
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

verify();
