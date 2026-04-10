const mysql = require('mysql2/promise');
const crypto = require('crypto');

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'admin',
  database: 'stock_analysis_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper function from dbService
function parseCommissionPercent(strategy) {
  if (!strategy?.parameters) return 20;
  const params = typeof strategy.parameters === 'string' 
    ? JSON.parse(strategy.parameters) 
    : strategy.parameters;
  return Number(params?.commission_percent || params?.commission || 20);
}

async function runSettlement() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const strategyId = 'strategy-1';
    const userId = 'user_1772105441338';
    const adminId = 'admin-settlement-test';
    
    console.log('\n=== RUNNING SETTLEMENT ===');
    console.log(`Strategy: ${strategyId}`);
    console.log(`User: ${userId}\n`);
    
    // Get strategy
    const [stratRows] = await connection.execute('SELECT * FROM strategies WHERE id = ?', [strategyId]);
    if (stratRows.length === 0) throw new Error('Strategy not found');
    const strategy = stratRows[0];
    strategy.parameters = typeof strategy.parameters === 'string' 
      ? JSON.parse(strategy.parameters || '{}') 
      : strategy.parameters;
    
    console.log('Strategy:', strategy.name);
    
    // Get last settlement for this user
    const [userLastItem] = await connection.execute(
      `SELECT ps.settlement_end 
       FROM profit_settlement_items psi
       JOIN profit_settlements ps ON psi.settlement_id = ps.id
       WHERE psi.user_id = ? AND psi.strategy_id = ?
       ORDER BY ps.settlement_end DESC LIMIT 1`,
      [userId, strategyId]
    );
    
    const userLastSettlementEnd = userLastItem[0]?.settlement_end;
    const settlementStart = userLastSettlementEnd || strategy.created_at;
    const settlementEnd = new Date();
    
    console.log(`Settlement period: ${settlementStart} to ${settlementEnd}\n`);
    
    // Get running strategy info
    console.log('=== RUNNING STRATEGY DATA ===');
    const [runningStrats] = await connection.execute(
      `SELECT rs.id, rs.user_id, rs.lot_size, rs.capital, u.name, u.email
       FROM running_strategies rs
       JOIN users u ON rs.user_id = u.id
       WHERE rs.strategy_id = ? AND rs.user_id = ?`,
      [strategyId, userId]
    );
    
    if (runningStrats.length === 0) {
      throw new Error('Running strategy not found for this user');
    }
    
    const rs = runningStrats[0];
    console.log(`User: ${rs.name} (${rs.user_id})`);
    console.log(`Email: ${rs.email}`);
    console.log(`Lot Size: ${rs.lot_size}`);
    console.log(`Capital: ${rs.capital}\n`);
    
    // Query master trades - THIS IS KEY!
    console.log('=== CHECKING MASTER TRADES ===');
    let masterAccountId = strategy.master_account_id;
    console.log(`Master Account ID: ${masterAccountId}`);
    
    if (!masterAccountId) {
      console.log('⚠ No master account ID! Settlement cannot calculate profits.');
      console.log('Master trades cannot be fetched without account ID.\n');
    }
    
    const [closedTrades] = await connection.execute(
      `SELECT COUNT(*) as count, SUM(profit) as total_profit, SUM(swap) as total_swap 
       FROM master_trades_cache 
       WHERE master_id = ? AND is_open = 0 AND time_close > ? AND time_close <= ?`,
      [masterAccountId, settlementStart, settlementEnd]
    );
    
    console.log(`Closed trades found: ${closedTrades[0].count}`);
    console.log(`Total profit: ${closedTrades[0].total_profit || 0}`);
    console.log(`Total swap: ${closedTrades[0].total_swap || 0}\n`);
    
    if (!closedTrades[0].count || closedTrades[0].total_profit <= 0) {
      console.log('ℹ No closed trades or no positive profit. Settlement would exit early.');
      console.log('\n⚠ REASON: All settlement records are empty because:');
      console.log('1. master_trades_cache is empty (no trades from master account)');
      console.log('2. Without master trades, settlement cannot calculate profits');
      console.log('3. This is expected if master account is not actively trading\n');
    }
    
    // Get wallet transactions
    console.log('=== WALLET TRANSACTIONS (Deposits) ===');
    const [depRows] = await connection.execute(
      `SELECT SUM(amount) as invested FROM wallet_transactions 
       WHERE user_id = ? AND strategy_id = ? AND transaction_type = "deposit" 
       AND status IN ("completed", "approved", "settled")`,
      [userId, strategyId]
    );
    
    const invested = Number(depRows[0]?.invested || 0);
    console.log(`Total invested: ${invested}\n`);
    
    // Calculate what WOULD be settled
    if (closedTrades[0].count && closedTrades[0].total_profit > 0) {
      console.log('=== SETTLEMENT CALCULATION ===');
      const totalProfit = Number(closedTrades[0].total_profit || 0);
      const totalSwap = Number(closedTrades[0].total_swap || 0);
      const commissionPercent = parseCommissionPercent(strategy);
      
      console.log(`Total profit from master: ${totalProfit}`);
      console.log(`Commission rate: ${commissionPercent}%`);
      
      const userShare = 1; // Single user
      const userGrossProfit = totalProfit * userShare;
      const userSwap = totalSwap * userShare;
      const commission = userGrossProfit * (commissionPercent / 100);
      const withdrawal = userGrossProfit - commission;
      const settledBalance = invested + userGrossProfit + userSwap - commission;
      
      console.log(`User gross profit: ${userGrossProfit}`);
      console.log(`User swap: ${userSwap}`);
      console.log(`Commission (${commissionPercent}%): ${commission}`);
      console.log(`Withdrawal: ${withdrawal}`);
      console.log(`Settled balance: ${settledBalance}\n`);
      
      // Create settlement records
      const settlementId = `ps_${Date.now()}`;
      const itemId = `psi_${generateId()}`;
      
      console.log('Creating settlement records...');
      
      await connection.execute(
        `INSERT INTO profit_settlement_items (
          id, settlement_id, strategy_id, user_id, user_name, user_email,
          invested_amount, gross_profit, swap_amount, commission_amount, withdrawal_amount, settled_balance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId, settlementId, strategyId, userId, rs.name, rs.email,
          invested, userGrossProfit, userSwap, commission, withdrawal, settledBalance,
        ]
      );
      
      await connection.execute(
        `INSERT INTO profit_settlements (
          id, strategy_id, settlement_start, settlement_end, total_profit,
          total_commission, total_withdrawal, total_swap, users_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          settlementId, strategyId, settlementStart, settlementEnd,
          userGrossProfit, commission, withdrawal, userSwap, 1,
        ]
      );
      
      // Update running strategy capital
      await connection.execute(
        'UPDATE running_strategies SET capital = ?, updated_at = NOW() WHERE user_id = ? AND strategy_id = ?',
        [settledBalance, userId, strategyId]
      );
      
      await connection.commit();
      console.log('✓ Settlement records created successfully!\n');
      
      // Verify
      const [psResults] = await connection.execute(
        'SELECT * FROM profit_settlements WHERE id = ?',
        [settlementId]
      );
      console.log('Settlement created:', psResults[0]);
    } else {
      await connection.rollback();
    }
    
    process.exit(0);
  } catch (err) {
    await connection.rollback();
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    connection.release();
  }
}

runSettlement();
