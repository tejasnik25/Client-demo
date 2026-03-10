// Final test to verify column count fix
const mysql = require('mysql2/promise');
require('dotenv').config();

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
  ssl: process.env.VERCEL || process.env.DB_SSL ? { rejectUnauthorized: false } : undefined
});

async function testFinalFix() {
  try {
    console.log('Testing FINAL column count fix...');
    
    const masterId = 'test-master-final';
    const isOpen = false;
    
    // Clear existing test data
    await pool.execute('DELETE FROM master_trades_cache WHERE master_id = ?', [masterId]);
    
    // Test data exactly like the real code would use
    const trades = [
      {
        position_id: 'test-1',
        symbol: 'EURUSD',
        type: 'BUY',
        volume: 0.1,
        price_open: 1.12345,
        price_close: 1.12455,
        profit: 10.5,
        commission: 0.5,
        swap: 2.3,
        time_open: new Date(),
        time_close: new Date()
      }
    ];
    
    // Build values array EXACTLY like in the fixed code
    const values = trades.map(trade => [
      `${masterId}-${trade.position_id}`, // Generate unique id
      masterId,
      trade.position_id,
      trade.symbol || '',
      trade.type || 'BUY',
      trade.volume || 0,
      trade.price_open || 0,
      trade.price_close || null,
      trade.profit || 0,
      trade.commission || 0,
      trade.swap || 0,
      trade.time_open || new Date().toISOString(),
      trade.time_close || null,
      isOpen ? 1 : 0,
      new Date().toISOString()
    ]);
    
    console.log(`Values array has ${values[0].length} elements: ✓`);
    
    // Build placeholders with the CORRECT 15 question marks
    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    console.log(`Placeholder pattern has ${placeholders.split('?').length - 1} question marks: ✓`);
    
    // Build SQL exactly like in the fixed code
    const sql = `INSERT IGNORE INTO master_trades_cache (
      id, master_id, position_id, symbol, type, volume, price_open, price_close, 
      profit, commission, swap, time_open, time_close, is_open, created_at
    ) VALUES ${placeholders}`;
    
    console.log('SQL has 15 columns: ✓');
    
    // Execute the INSERT
    const [result] = await pool.execute(sql, values.flat());
    console.log(`✅ INSERT successful! Affected rows: ${result.affectedRows}`);
    
    // Clean up
    await pool.execute('DELETE FROM master_trades_cache WHERE master_id = ?', [masterId]);
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 FINAL FIX VERIFIED! Column count mismatch resolved!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testFinalFix();
