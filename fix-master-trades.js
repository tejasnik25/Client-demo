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

async function fix() {
  try {
    const conn = await pool.getConnection();
    
    console.log('\n=== FIXING COLUMN NAMES ===\n');
    
    // Drop old table
    console.log('1. Dropping old master_trades_cache...');
    await conn.execute('DROP TABLE IF EXISTS master_trades_cache');
    console.log('   ✓ Dropped');
    
    // Create new table with correct column names
    console.log('\n2. Creating master_trades_cache with correct columns...');
    await conn.execute(`
      CREATE TABLE master_trades_cache (
        id VARCHAR(255) PRIMARY KEY,
        master_id VARCHAR(255) NOT NULL,
        symbol VARCHAR(50) NOT NULL,
        position_type ENUM('buy', 'sell') NOT NULL,
        time_open TIMESTAMP NOT NULL,
        time_close TIMESTAMP,
        open_price DECIMAL(18,8) NOT NULL,
        close_price DECIMAL(18,8),
        volume DECIMAL(14,4) NOT NULL,
        profit DECIMAL(18,2) NOT NULL DEFAULT 0,
        swap DECIMAL(18,2) NOT NULL DEFAULT 0,
        commission DECIMAL(18,2) NOT NULL DEFAULT 0,
        is_open TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_master_id (master_id),
        INDEX idx_symbol (symbol),
        INDEX idx_is_open (is_open),
        INDEX idx_time_close (time_close)
      )
    `);
    console.log('   ✓ Table created with correct columns');
    
    // Re-insert trades
    console.log('\n3. Inserting sample master trades...');
    const masterAccountId = '270852965';
    
    const trades = [
      {
        id: `trade_${Date.now()}_1`,
        master_id: masterAccountId,
        symbol: 'EURUSD',
        position_type: 'buy',
        time_open: new Date(Date.now() - 6 * 60 * 60 * 1000),
        time_close: new Date(Date.now() - 1 * 60 * 60 * 1000),
        open_price: 1.0850,
        close_price: 1.0920,
        volume: 1.0,
        profit: 70.00,
        swap: 2.50,
        commission: 7.00,
        is_open: 0
      },
      {
        id: `trade_${Date.now()}_2`,
        master_id: masterAccountId,
        symbol: 'GBPUSD',
        position_type: 'sell',
        time_open: new Date(Date.now() - 4 * 60 * 60 * 1000),
        time_close: new Date(Date.now() - 2 * 60 * 60 * 1000),
        open_price: 1.2650,
        close_price: 1.2580,
        volume: 0.5,
        profit: 35.00,
        swap: -1.00,
        commission: 3.50,
        is_open: 0
      },
      {
        id: `trade_${Date.now()}_3`,
        master_id: masterAccountId,
        symbol: 'USDJPY',
        position_type: 'buy',
        time_open: new Date(Date.now() - 2 * 60 * 60 * 1000),
        time_close: new Date(Date.now() - 30 * 60 * 1000),
        open_price: 149.50,
        close_price: 149.85,
        volume: 2.0,
        profit: 100.00,
        swap: 5.00,
        commission: 10.00,
        is_open: 0
      }
    ];
    
    for (const trade of trades) {
      await conn.execute(
        `INSERT INTO master_trades_cache 
         (id, master_id, symbol, position_type, time_open, time_close, open_price, close_price, volume, profit, swap, commission, is_open) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          trade.id, trade.master_id, trade.symbol, trade.position_type, 
          trade.time_open, trade.time_close, trade.open_price, trade.close_price,
          trade.volume, trade.profit, trade.swap, trade.commission, trade.is_open
        ]
      );
    }
    console.log(`   ✓ Inserted ${trades.length} trades`);
    
    conn.release();
    console.log('\n✓ Fixed! Ready for settlement.\n');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

fix();
