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
    
    console.log('\n=== MASTER TRADES CACHE CONTENTS ===\n');
    const [trades] = await conn.query(`SELECT id, symbol, profit, time_close FROM master_trades_cache ORDER BY time_close DESC`);
    console.log(`Total trades: ${trades.length}`);
    console.table(trades);
    
    if (trades.length > 0) {
      console.log('\n=== TRADE TIME RANGES ===');
      const minTime = new Date(Math.min(...trades.map(t => new Date(t.time_close).getTime())));
      const maxTime = new Date(Math.max(...trades.map(t => new Date(t.time_close).getTime())));
      console.log(`Earliest close: ${minTime}`);
      console.log(`Latest close: ${maxTime}`);
      console.log(`Now: ${new Date()}`);
    }
    
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

check();
