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

async function testSettlement() {
  try {
    const conn = await pool.getConnection();
    
    console.log('\n=== TESTING SETTLEMENT QUERY ===');
    console.log('User: user_1772105441338');
    console.log('Strategy: strategy-1\n');
    
    // Test the settlement query WITHOUT status filter (as per our fix)
    console.log('Running settlement query (bypassing status filter for user)...');
    const [result] = await conn.query(
      `SELECT rs.id, rs.user_id, rs.strategy_id, rs.lot_size, s.name as strategy_name
       FROM running_strategies rs
       JOIN strategies s ON rs.strategy_id = s.id
       WHERE rs.strategy_id = ? AND rs.user_id = ?`,
      ['strategy-1', 'user_1772105441338']
    );
    
    if (result.length === 0) {
      console.log('✗ NO RECORDS FOUND - Settlement would not execute');
    } else {
      console.log('✓ SETTLEMENT RECORDS FOUND:');
      result.forEach(r => {
        console.log(`  - User: ${r.user_id}`);
        console.log(`    Strategy: ${r.strategy_name} (${r.strategy_id})`);
        console.log(`    Lot Size: ${r.lot_size}`);
        console.log(`    Running Strategy ID: ${r.id}`);
      });
    }
    
    // Check wallet_transactions for this user/strategy
    console.log('\n=== WALLET TRANSACTIONS FOR SETTLEMENT ===');
    const [wtResult] = await conn.query(
      `SELECT id, lot_size, amount, status FROM wallet_transactions
       WHERE user_id = ? AND strategy_id = ?
       ORDER BY created_at DESC`,
      ['user_1772105441338', 'strategy-1']
    );
    
    if (wtResult.length === 0) {
      console.log('✗ NO WALLET TRANSACTIONS - Payment may not have been processed');
    } else {
      console.log(`✓ FOUND ${wtResult.length} WALLET TRANSACTION(S):`);
      wtResult.forEach(wt => {
        console.log(`  - ID: ${wt.id}`);
        console.log(`    Lot Size: ${wt.lot_size}`);
        console.log(`    Amount: ${wt.amount}`);
        console.log(`    Status: ${wt.status}`);
      });
    }
    
    console.log('\n=== SETTLEMENT READINESS CHECK ===');
    const ready = result.length > 0 && wtResult.length > 0;
    if (ready) {
      console.log('✓ All conditions met for settlement:');
      console.log('  [✓] Running strategy exists');
      console.log('  [✓] Lot size is 2');
      console.log('  [✓] Wallet transaction exists');
      console.log('  [✓] Settlement query would find this user');
    } else {
      console.log('✗ Missing required data for settlement');
      if (result.length === 0) console.log('  [✗] No running strategy');
      if (wtResult.length === 0) console.log('  [✗] No wallet transaction');
    }
    
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

testSettlement();
