const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'next-auth.session-token=test-token'
      }
    };
    
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testLotSizingFlow() {
  console.log('\n=== LOT SIZING VERIFICATION TEST ===\n');
  
  try {
    // 1. Verify running strategy API returns lot_size = 2
    console.log('1. Checking /api/strategies/running endpoint...');
    console.log('   (This is what the history page uses to display lot sizes)\n');
    
    const runningResult = await makeRequest('/api/strategies/running', 'POST', {
      strategyId: 'strategy-1'
    });
    
    console.log('   Endpoint status:', runningResult.status);
    if (runningResult.data?.runningStrategies) {
      const rs = runningResult.data.runningStrategies.find(r => r.strategyId === 'strategy-1');
      if (rs) {
        console.log('   ✓ Found running strategy for strategy-1');
        console.log('   Lot size:', rs.lotSize);
        if (rs.lotSize === 2) {
          console.log('   ✓ lot_size = 2 CORRECT');
        } else {
          console.log('   ✗ lot_size incorrect (expected 2, got ' + rs.lotSize + ')');
        }
      } else {
        console.log('   ✗ Strategy not found in response');
      }
    } else {
      console.log('   Response:', runningResult.data);
    }
    
  } catch (err) {
    console.log('   Note: API test skipped (server may not be running)');
    console.log('   Error:', err.message);
  }
  
  console.log('\n=== DIRECT DATABASE VERIFICATION ===\n');
  
  // Direct database verification
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'stock_analysis_db'
  });
  
  try {
    const conn = await pool.getConnection();
    
    // Check wallet transaction
    console.log('2. Wallet transaction for user (payment phase):');
    const [wt] = await conn.query(
      `SELECT lot_size, amount FROM wallet_transactions WHERE user_id = ? AND strategy_id = ?`,
      ['user_1772105441338', 'strategy-1']
    );
    if (wt.length > 0) {
      console.log('   ✓ Payment record found');
      console.log('   lot_size in payment:', wt[0].lot_size);
      console.log('   amount:', wt[0].amount);
    }
    
    // Check running strategy
    console.log('\n3. Running strategy created after payment approval:');
    const [rs] = await conn.query(
      `SELECT lot_size, status FROM running_strategies WHERE user_id = ? AND strategy_id = ?`,
      ['user_1772105441338', 'strategy-1']
    );
    if (rs.length > 0) {
      console.log('   ✓ Running strategy record found');
      console.log('   lot_size from running_strategies:', rs[0].lot_size);
      console.log('   status:', rs[0].status);
      if (rs[0].lot_size === wt[0].lot_size) {
        console.log('   ✓ Lot sizes MATCH - persistence confirmed');
      } else {
        console.log('   ✗ Lot sizes DO NOT match');
      }
    }
    
    // Get strategy parameters
    console.log('\n4. Strategy parameters (fallback if running strategy is default):');
    const [strat] = await conn.query(
      `SELECT parameters FROM strategies WHERE id = ?`,
      ['strategy-1']
    );
    if (strat.length > 0) {
      const params = typeof strat[0].parameters === 'string' 
        ? JSON.parse(strat[0].parameters) 
        : strat[0].parameters;
      console.log('   Strategy parameters:', params);
      const stratLotSize = params?.lotSize || 1;
      console.log('   Default lot_size from strategy:', stratLotSize);
    }
    
    console.log('\n=== LOT SIZE PRIORITY CHECK ===');
    console.log('Priority order (as per our fixes):');
    console.log('1. Payment lot_size:', wt[0]?.lot_size || 'NONE');
    console.log('2. Running strategy lot_size:', rs[0]?.lot_size || 'NONE');
    console.log('3. Strategy parameters lot_size:', strat[0]?.parameters?.lotSize || 1);
    console.log('\nDisplay lot_size should be:', wt[0]?.lot_size || rs[0]?.lot_size || 1);
    
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

testLotSizingFlow();
