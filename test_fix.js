// Test script to verify the fix
const { upsertMasterTrades } = require('./src/db/dbService.ts');

async function testFix() {
  try {
    console.log('Testing upsertMasterTrades with sample data...');
    
    const sampleTrades = [
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
        time_open: new Date().toISOString(),
        time_close: new Date().toISOString()
      },
      {
        position_id: 'test-2',
        symbol: 'GBPUSD',
        type: 'SELL',
        volume: 0.2,
        price_open: 1.23456,
        price_close: 1.23345,
        profit: -5.2,
        commission: 0.8,
        swap: -1.1,
        time_open: new Date().toISOString(),
        time_close: new Date().toISOString()
      }
    ];
    
    await upsertMasterTrades('test-master-123', sampleTrades, false);
    console.log('✅ Test passed! No column count errors.');
    
    // Test with open positions
    await upsertMasterTrades('test-master-456', sampleTrades.slice(0, 1), true);
    console.log('✅ Open positions test passed!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testFix();
