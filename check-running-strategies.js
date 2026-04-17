/**
 * Check running strategies for user_1775738809201
 * to see if $8500 is the capital/balance in running strategies
 */

const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "copy_trade",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function checkRunningStrategies() {
  const connection = await pool.getConnection();
  try {
    console.log("🔍 RUNNING STRATEGIES FOR user_1775738809201\n");
    console.log("=" .repeat(80) + "\n");

    // Get all running strategies for this user
    const [strategies] = await connection.execute(
      `SELECT rs.*, s.name as strategy_name
       FROM running_strategies rs
       LEFT JOIN strategies s ON rs.strategy_id = s.id
       WHERE rs.user_id = ?
       ORDER BY rs.created_at ASC`,
      ["user_1775738809201"]
    );

    if (!strategies || strategies.length === 0) {
      console.log("❌ No running strategies found for this user");
      return;
    }

    console.log(`📊 Found ${strategies.length} running strategy/ies:\n`);

    let totalCapitalInStrategies = 0;

    strategies.forEach((rs, idx) => {
      console.log(`${idx + 1}. Running Strategy ID: ${rs.id}`);
      console.log(`   Strategy Name: ${rs.strategy_name || 'Unknown'}`);
      console.log(`   Status: ${rs.status}`);
      console.log(`   Admin Status: ${rs.admin_status}`);
      console.log(`   Capital: $${Number(rs.capital || 0).toFixed(2)}`);
      totalCapitalInStrategies += Number(rs.capital || 0);
      if (rs.lot_size) console.log(`   Lot Size: ${Number(rs.lot_size).toFixed(4)}`);
      console.log(`   Created: ${rs.created_at}`);
      console.log(`   Updated: ${rs.updated_at}`);
      console.log("");
    });

    console.log("=" .repeat(80));
    console.log(`\n💰 TOTAL CAPITAL IN RUNNING STRATEGIES: $${totalCapitalInStrategies.toFixed(2)}`);
    console.log(`\n🔎 This might be the "$8500" you're seeing in the "Balance Operations" tab.\n`);

    // Also check wallet transactions linked to these strategies
    console.log("=" .repeat(80) + "\n");
    console.log("📋 WALLET TRANSACTIONS BY STRATEGY:\n");

    for (const rs of strategies) {
      const [txs] = await connection.execute(
        `SELECT transaction_type, status, SUM(amount) as total_amount, COUNT(*) as count
         FROM wallet_transactions 
         WHERE user_id = ? AND strategy_id = ?
         GROUP BY transaction_type, status
         ORDER BY transaction_type`,
        ["user_1775738809201", rs.strategy_id]
      );

      console.log(`Strategy: ${rs.strategy_name || rs.strategy_id}`);
      if (txs && txs.length > 0) {
        txs.forEach(tx => {
          console.log(`  ${tx.transaction_type.toUpperCase()} (${tx.status}): $${Number(tx.total_amount).toFixed(2)} x${tx.count}`);
        });
      }
      console.log("");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.release();
    await pool.end();
  }
}

checkRunningStrategies().catch(console.error);
