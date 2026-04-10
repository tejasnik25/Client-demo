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

async function insertTestData() {
  try {
    const conn = await pool.getConnection();
    
    console.log('\n1. Inserting wallet transaction with lot_size = 2...');
    try {
      const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      await conn.query(
        `INSERT INTO wallet_transactions (id, user_id, strategy_id, lot_size, amount, status, transaction_type) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [txId, 'user_1772105441338', 'strategy-1', 2, 200.00, 'completed', 'charge']
      );
      console.log('✓ Wallet transaction inserted with lot_size = 2');
    } catch (err) {
      console.log('✗ Wallet transaction insert error:', err.message);
    }
    
    // Verify
    console.log('\n=== VERIFICATION ===');
    
    const [wt] = await conn.query(
      'SELECT id, lot_size, amount FROM wallet_transactions WHERE user_id = ? AND strategy_id = ? ORDER BY created_at DESC LIMIT 1', 
      ['user_1772105441338', 'strategy-1']
    );
    console.log('Wallet transactions:', wt.length, 'records');
    if (wt.length > 0) {
      console.log('  ID:', wt[0].id);
      console.log('  lot_size:', wt[0].lot_size);
      console.log('  amount:', wt[0].amount);
    }
    
    const [rs] = await conn.query(
      'SELECT id, lot_size, status FROM running_strategies WHERE user_id = ? AND strategy_id = ?',
      ['user_1772105441338', 'strategy-1']
    );
    console.log('\nRunning strategies:', rs.length, 'records');
    if (rs.length > 0) {
      console.log('  ID:', rs[0].id);
      console.log('  lot_size:', rs[0].lot_size);
      console.log('  status:', rs[0].status);
    }
    
    conn.release();
    console.log('\n✓ Test data setup completed!');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

insertTestData();
