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
    
    console.log('\n=== STRATEGIES TABLE SCHEMA ===');
    const [schema] = await conn.query(`DESCRIBE strategies`);
    console.table(schema);
    
    console.log('\n=== STRATEGY-1 RECORD ===');
    const [strat] = await conn.query('SELECT * FROM strategies WHERE id = ?', ['strategy-1']);
    console.log(JSON.stringify(strat[0], null, 2));
    
    console.log('\n=== MASTER_TRADES_CACHE TABLE SCHEMA ===');
    try {
      const [mtSchema] = await conn.query(`DESCRIBE master_trades_cache`);
      console.log('Exists:', mtSchema.length > 0 ? 'YES' : 'NO');
      console.table(mtSchema);
    } catch (e) {
      console.log('Table does not exist');
    }
    
    console.log('\n=== ALL STRATEGIES ===');
    const [allStrats] = await conn.query('SELECT id, name, master_account_id FROM strategies');
    console.table(allStrats);
    
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

check();
