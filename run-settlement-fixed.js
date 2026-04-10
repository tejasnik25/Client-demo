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

async function settle() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const strategyId = 'strategy-1';
    const userId = 'user_1772105441338';
    
    console.log('\n=== RUNNING SETTLEMENT (FIXED) ===\n');
    
    const [stratRows] = await connection.execute('SELECT * FROM strategies WHERE id = ?', [strategyId]);
    const strategy = stratRows[0];
    strategy.parameters = typeof strategy.parameters === 'string' 
      ? JSON.parse(strategy.parameters || '{}') 
      : strategy.parameters;
    
    // Set settlement start much earlier to capture trades
    // Use 24 hours ago to be safe
    const settlementStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const settlementEnd = new Date();
    
    console.log(`Strategy: ${strategy.name}`);
    console.log(`Settlement period: ${settlementStart} to ${settlementEnd}\n`);
    
    // Get closed trades
    const [closedTrades] = await connection.execute(
      `SELECT SUM(profit) as total_profit, SUM(swap) as total_swap 
       FROM master_trades_cache 
       WHERE master_id = ? AND is_open = 0 AND time_close > ? AND time_close <= ?`,
      [strategy.master_account_id, settlementStart, settlementEnd]
    );
    
    const totalProfit = Number(closedTrades[0]?.total_profit || 0);
    const totalSwap = Number(closedTrades[0]?.total_swap || 0);
    
    console.log(`Total profit from master: ${totalProfit}`);
    console.log(`Total swap: ${totalSwap}\n`);
    
    if (totalProfit <= 0) {
      console.log('No positive profit. Exiting.');
      await connection.rollback();
      process.exit(0);
    }
    
    // Get running strategy
    const [runningStrats] = await connection.execute(
      `SELECT rs.id, rs.user_id, rs.lot_size, rs.capital, u.name, u.email
       FROM running_strategies rs
       JOIN users u ON rs.user_id = u.id
       WHERE rs.strategy_id = ? AND rs.user_id = ?`,
      [strategyId, userId]
    );
    
    const rs = runningStrats[0];
    
    // Get invested amount from wallet transactions
    const [depRows] = await connection.execute(
      `SELECT SUM(amount) as invested FROM wallet_transactions 
       WHERE user_id = ? AND strategy_id = ? AND transaction_type = "deposit" 
       AND status IN ("completed", "approved", "settled")`,
      [userId, strategyId]
    );
    
    const invested = Number(depRows[0]?.invested || 200); // Default to 200 if not in wallet_transactions
    
    // Commission calculation
    const commissionPercent = strategy.parameters?.commission_percent || 20;
    const userGrossProfit = totalProfit; // Single user gets all profit
    const userSwap = totalSwap;
    const commission = userGrossProfit * (commissionPercent / 100);
    const withdrawal = userGrossProfit - commission;
    const settledBalance = invested + userGrossProfit + userSwap - commission;
    
    console.log('=== SETTLEMENT CALCULATION ===');
    console.log(`Invested: $${invested}`);
    console.log(`Gross profit: $${userGrossProfit}`);
    console.log(`Swap: $${userSwap}`);
    console.log(`Commission (${commissionPercent}%): $${commission}`);
    console.log(`Withdrawal: $${withdrawal}`);
    console.log(`Settled balance: $${settledBalance}\n`);
    
    // Create settlement records
    const settlementId = `ps_${Date.now()}`;
    const itemId = `psi_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    console.log('Creating settlement records...\n');
    
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
    
    console.log('✓ Settlement complete!');
    console.log(`Settlement ID: ${settlementId}\n`);
    
    // Verify
    const [psResults] = await connection.execute(
      `SELECT ps.*, COUNT(psi.id) as item_count 
       FROM profit_settlements ps
       LEFT JOIN profit_settlement_items psi ON ps.id = psi.settlement_id
       WHERE ps.id = ?
       GROUP BY ps.id`,
      [settlementId]
    );
    
    console.log('=== SETTLEMENT CREATED ===');
    console.log(JSON.stringify(psResults[0], null, 2));
    
    const [psiResults] = await connection.execute(
      'SELECT * FROM profit_settlement_items WHERE settlement_id = ?',
      [settlementId]
    );
    
    console.log('\n=== SETTLEMENT ITEMS ===');
    console.log(JSON.stringify(psiResults[0], null, 2));
    
    connection.release();
    process.exit(0);
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

settle();
