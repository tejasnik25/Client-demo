// Test script to verify master trades functionality
const { upsertMasterTrades, getCachedMasterTrades } = require('./src/db/dbService.js');

async function testMasterTrades() {
  console.log('Testing master trades functionality...');
  
  const masterId = '270870850';
  
  // Test with sample data
  const sampleTrades = [
    {
      position_id: 'test_001',
      symbol: 'EUR/USD',
      type: 'BUY',
      volume: 0.1,
      price_open: 1.0850,
      price_close: 1.0900,
      profit: 50,
      time_open: new Date().toISOString(),
      time_close: new Date().toISOString()
    }
  ];
  
  try {
    // Test upsert
    console.log('Testing upsert...');
    await upsertMasterTrades(masterId, sampleTrades, false);
    
    // Test retrieve
    console.log('Testing retrieve...');
    const result = await getCachedMasterTrades(masterId);
    
    console.log('Result:', {
      historyCount: result.history.length,
      openCount: result.open_positions.length,
      success: true
    });
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testMasterTrades();
