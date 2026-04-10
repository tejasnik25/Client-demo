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

async function migrate() {
  try {
    const conn = await pool.getConnection();
    
    console.log('\n=== ADDING MISSING COLUMNS & TABLES ===\n');
    
    // 1. Add master_account_id column to strategies
    console.log('1. Adding master_account_id column to strategies...');
    try {
      await conn.execute(
        `ALTER TABLE strategies ADD COLUMN master_account_id VARCHAR(255) NULL`
      );
      console.log('   ✓ Column added');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('   ↻ Column already exists');
      } else {
        throw e;
      }
    }
    
    // 2. Create master_trades_cache table
    console.log('\n2. Creating master_trades_cache table...');
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS master_trades_cache (
          id VARCHAR(255) PRIMARY KEY,
          master_id VARCHAR(255) NOT NULL,
          symbol VARCHAR(50) NOT NULL,
          position_type ENUM('buy', 'sell') NOT NULL,
          open_time TIMESTAMP NOT NULL,
          close_time TIMESTAMP,
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
          INDEX idx_close_time (close_time)
        )
      `);
      console.log('   ✓ Table created');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('   ↻ Table already exists');
      } else {
        throw e;
      }
    }
    
    // 3. Update growth momentum strategy with master account ID
    console.log('\n3. Setting master account for Growth Momentum strategy...');
    const masterAccountId = '270852965'; // Use a test MT5 account ID
    await conn.execute(
      `UPDATE strategies SET master_account_id = ? WHERE id = 'strategy-1'`,
      [masterAccountId]
    );
    console.log(`   ✓ Master account ID set to: ${masterAccountId}`);
    
    // 4. Insert sample master trades for testing
    console.log('\n4. Inserting sample master trades for settlement testing...');
    
    const trades = [
      {
        id: `trade_${Date.now()}_1`,
        master_id: masterAccountId,
        symbol: 'EURUSD',
        position_type: 'buy',
        open_time: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        close_time: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
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
        open_time: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        close_time: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
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
        open_time: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        close_time: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
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
         (id, master_id, symbol, position_type, open_time, close_time, open_price, close_price, volume, profit, swap, commission, is_open) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          trade.id, trade.master_id, trade.symbol, trade.position_type, 
          trade.open_time, trade.close_time, trade.open_price, trade.close_price,
          trade.volume, trade.profit, trade.swap, trade.commission, trade.is_open
        ]
      );
    }
    console.log(`   ✓ Inserted ${trades.length} sample trades`);
    console.log(`     Total profit: $${trades.reduce((sum, t) => sum + t.profit, 0)}`);
    console.log(`     Total swap: $${trades.reduce((sum, t) => sum + t.swap, 0)}`);
    
    // Verify
    console.log('\n=== VERIFICATION ===\n');
    
    const [strat] = await conn.execute('SELECT id, name, master_account_id FROM strategies WHERE id = ?', ['strategy-1']);
    console.log('Strategy:', strat[0]);
    
    const [tradeCnt] = await conn.execute(
      'SELECT COUNT(*) as cnt, SUM(profit) as total_profit FROM master_trades_cache WHERE master_id = ?',
      [masterAccountId]
    );
    console.log(`\nMaster trades: ${tradeCnt[0].cnt} trades, Total profit: $${tradeCnt[0].total_profit}`);
    
    conn.release();
    console.log('\n✓ Migration complete! Settlement is now ready to run.\n');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

migrate();
