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

async function check() {
  try {
    const conn = await pool.getConnection();
    
    console.log('\n=== PROFIT SETTLEMENTS TABLE ===');
    const [ps] = await conn.query(`SELECT * FROM profit_settlements`);
    console.log('Total profit_settlements records:', ps.length);
    if (ps.length > 0) {
      console.log('Sample records:');
      ps.slice(0, 3).forEach(r => {
        console.log(`  ID: ${r.id}`);
        console.log(`  Strategy: ${r.strategy_id}`);
        console.log(`  Total Profit: ${r.total_profit}`);
        console.log(`  Total Commission: ${r.total_commission}`);
        console.log(`  Created: ${r.created_at}\n`);
      });
    }
    
    console.log('=== PROFIT SETTLEMENT ITEMS ===');
    const [psi] = await conn.query(`SELECT * FROM profit_settlement_items`);
    console.log('Total profit_settlement_items records:', psi.length);
    if (psi.length > 0) {
      console.log('Sample records:');
      psi.slice(0, 3).forEach(r => {
        console.log(`  Settlement ID: ${r.settlement_id}`);
        console.log(`  User ID: ${r.user_id}`);
        console.log(`  Profit: ${r.profit}`);
        console.log(`  Commission: ${r.commission}\n`);
      });
    }
    
    console.log('=== RUNNING PERIODS ===');
    const [rp] = await conn.query(`SELECT * FROM running_periods`);
    console.log('Total running_periods records:', rp.length);
    if (rp.length > 0) {
      console.log('Sample records:');
      rp.slice(0, 3).forEach(r => {
        console.log(`  ID: ${r.id}`);
        console.log(`  Strategy: ${r.strategy_id}`);
        console.log(`  User: ${r.user_id}`);
        console.log(`  Status: ${r.status}\n`);
      });
    }
    
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

check();
