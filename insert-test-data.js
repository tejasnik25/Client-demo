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
    
    // 1. Insert Growth Momentum strategy
    console.log('\n1. Inserting Growth Momentum strategy...');
    try {
      await conn.query(
        `INSERT INTO strategies (id, name, description, performance, risk_level, category, enabled) 
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        ['strategy-1', 'Growth Momentum', 'High-growth stocks with strong momentum indicators', 85, 'High', 'Growth', 1]
      );
      console.log('✓ Strategy inserted');
    } catch (err) {
      console.log('✗ Strategy insert error (may already exist):', err.message);
    }
    
    // 2. Insert test user (or use existing)
    console.log('\n2. Inserting test user (user_1772105441338)...');
    try {
      await conn.query(
        `INSERT INTO users (id, name, email, password, wallet_balance, email_verified) 
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        ['user_1772105441338', 'Test User Copy Trade', 'copy-trader@example.com', 'hashed_password', 500.00, 1]
      );
      console.log('✓ User inserted');
    } catch (err) {
      console.log('✗ User insert error:', err.message);
    }
    
    // 3. Insert wallet transaction with lot_size = 2
    console.log('\n3. Inserting wallet transaction with lot_size = 2...');
    try {
      const txId = `tx_user1772105441338_strategy1_${Date.now()}`;
      await conn.query(
        `INSERT INTO wallet_transactions (id, user_id, strategy_id, lot_size, amount, status, type) 
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE lot_size = VALUES(lot_size)`,
        [txId, 'user_1772105441338', 'strategy-1', 2, 200.00, 'approved', 'strategy_subscription']
      );
      console.log('✓ Wallet transaction inserted with lot_size = 2');
    } catch (err) {
      console.log('✗ Wallet transaction insert error:', err.message);
    }
    
    // 4. Insert running strategy
    console.log('\n4. Inserting running strategy...');
    try {
      const rsId = `rs_user1772105441338_strategy1_${Date.now()}`;
      await conn.query(
        `INSERT INTO running_strategies (id, user_id, strategy_id, lot_size, status) 
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE lot_size = VALUES(lot_size)`,
        [rsId, 'user_1772105441338', 'strategy-1', 2, 'active']
      );
      console.log('✓ Running strategy inserted with lot_size = 2');
    } catch (err) {
      console.log('✗ Running strategy insert error:', err.message);
    }
    
    // Verify data
    console.log('\n=== VERIFICATION ===');
    
    const [users] = await conn.query('SELECT id, name FROM users WHERE id = ?', ['user_1772105441338']);
    console.log('User found:', users.length > 0 ? '✓' : '✗', users);
    
    const [strategies] = await conn.query('SELECT id, name FROM strategies WHERE id = ?', ['strategy-1']);
    console.log('Strategy found:', strategies.length > 0 ? '✓' : '✗', strategies);
    
    const [wt] = await conn.query('SELECT id, lot_size FROM wallet_transactions WHERE user_id = ? AND strategy_id = ?', 
      ['user_1772105441338', 'strategy-1']);
    console.log('Wallet transactions:', wt.length, 'records', wt.length > 0 ? `(lot_size = ${wt[0].lot_size})` : '');
    
    const [rs] = await conn.query('SELECT id, lot_size FROM running_strategies WHERE user_id = ? AND strategy_id = ?',
      ['user_1772105441338', 'strategy-1']);
    console.log('Running strategies:', rs.length, 'records', rs.length > 0 ? `(lot_size = ${rs[0].lot_size})` : '');
    
    conn.release();
    console.log('\n✓ Test data setup completed!');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

insertTestData();
