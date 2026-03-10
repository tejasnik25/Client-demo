const mysql = require('mysql2/promise');

async function addTestData() {
  try {
    const connection = await mysql.createConnection({
      host: 'stock-analysis-db.cx8ioemygq4m.ap-south-1.rds.amazonaws.com',
      user: 'admin',
      password: 'your_password_here', // You'll need to provide this
      database: 'stock_analysis_db'
    });

    console.log('Connected to database, adding test master trades...');
    
    // Add test data for master account 270870850
    const testHistory = [
      {
        id: 'test_001',
        master_id: '270870850',
        position_id: '270870850_001',
        symbol: 'EUR/USD',
        type: 'BUY',
        volume: 0.1,
        price_open: 1.0850,
        price_close: 1.0900,
        profit: 50,
        commission: 0.5,
        swap: 0,
        time_open: '2026-03-09T10:00:00Z',
        time_close: '2026-03-09T10:30:00Z',
        is_open: 0,
        created_at: new Date()
      },
      {
        id: 'test_002',
        master_id: '270870850',
        position_id: '270870850_002',
        symbol: 'GBP/USD',
        type: 'SELL',
        volume: 0.2,
        price_open: 1.2650,
        price_close: 1.2600,
        profit: 100,
        commission: 1.0,
        swap: -0.5,
        time_open: '2026-03-09T09:00:00Z',
        time_close: '2026-03-09T09:45:00Z',
        is_open: 0,
        created_at: new Date()
      }
    ];
    
    const testOpenPositions = [
      {
        id: 'test_003',
        master_id: '270870850',
        position_id: '270870850_003',
        symbol: 'USD/JPY',
        type: 'BUY',
        volume: 0.15,
        price_open: 148.50,
        price_close: null,
        profit: 25,
        commission: 0.3,
        swap: 0,
        time_open: '2026-03-10T04:00:00Z',
        time_close: null,
        is_open: 1,
        created_at: new Date()
      }
    ];
    
    // Insert test data
    for (const trade of testHistory) {
      await connection.execute(
        'INSERT INTO master_trades_cache (id, master_id, position_id, symbol, type, volume, price_open, price_close, profit, commission, swap, time_open, time_close, is_open, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [trade.id, trade.master_id, trade.position_id, trade.symbol, trade.type, trade.volume, trade.price_open, trade.price_close, trade.profit, trade.commission, trade.swap, trade.time_open, trade.time_close, trade.is_open, trade.created_at]
      );
    }
    
    for (const position of testOpenPositions) {
      await connection.execute(
        'INSERT INTO master_trades_cache (id, master_id, position_id, symbol, type, volume, price_open, price_close, profit, commission, swap, time_open, time_close, is_open, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [position.id, position.master_id, position.position_id, position.symbol, position.type, position.volume, position.price_open, position.price_close, position.profit, position.commission, position.swap, position.time_open, position.time_close, position.is_open, position.created_at]
      );
    }
    
    console.log('✅ Test master trades added successfully');
    console.log(`Added ${testHistory.length} closed trades and ${testOpenPositions.length} open positions`);
    
    await connection.end();
    
  } catch (error) {
    console.error('Failed to add test master trades:', error);
  }
}

addTestData();
