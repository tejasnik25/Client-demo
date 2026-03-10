const mysql = require('mysql2/promise');
require('dotenv').config();

async function testMasterTradesTable() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'admin',
      database: process.env.DB_NAME || 'stock_analysis_db',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 2,
      idleTimeout: 30000,
      queueLimit: 0,
      connectTimeout: 20000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });

    console.log('Testing master_trades table...');
    
    // Test if we can query the table
    const [rows] = await pool.execute('SELECT * FROM master_trades WHERE master_id = ? ORDER BY time_open DESC', ['270870850']);
    
    console.log(`✅ Successfully queried master_trades table. Found ${rows.length} records for master_id 270870850`);
    
    // Test inserting a sample record
    const testRecord = {
      id: `test-${Date.now()}`,
      master_id: '270870850',
      position_id: 'test-position-123',
      symbol: 'EURUSD',
      type: 'BUY',
      volume: 0.1,
      price_open: 1.10000,
      price_close: 1.10500,
      profit: 50.0,
      time_open: new Date(),
      is_open: false
    };
    
    await pool.execute(`
      INSERT INTO master_trades (id, master_id, position_id, symbol, type, volume, price_open, price_close, profit, time_open, is_open)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      testRecord.id,
      testRecord.master_id,
      testRecord.position_id,
      testRecord.symbol,
      testRecord.type,
      testRecord.volume,
      testRecord.price_open,
      testRecord.price_close,
      testRecord.profit,
      testRecord.time_open,
      testRecord.is_open
    ]);
    
    console.log('✅ Successfully inserted test record');
    
    // Clean up test record
    await pool.execute('DELETE FROM master_trades WHERE id = ?', [testRecord.id]);
    console.log('✅ Successfully cleaned up test record');
    
    await pool.end();
    console.log('✅ Database test completed successfully - the master_trades table is working correctly!');
  } catch (error) {
    console.error('❌ Error testing master_trades table:', error);
    process.exit(1);
  }
}

testMasterTradesTable();
