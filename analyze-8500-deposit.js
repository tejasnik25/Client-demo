/**
 * Detailed transaction analysis for user_1775738809201
 * Trace all deposits and identify the source of $8500
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

async function analyzeTransactions() {
  const connection = await pool.getConnection();
  try {
    console.log("🔍 DETAILED TRANSACTION ANALYSIS FOR user_1775738809201\n");
    console.log("=" .repeat(80) + "\n");

    // Get ALL transactions (not just 20)
    const [allTx] = await connection.execute(
      `SELECT id, amount, transaction_type, status, created_at, admin_message, strategy_id
       FROM wallet_transactions 
       WHERE user_id = ? 
       ORDER BY created_at ASC`,
      ["user_1775738809201"]
    );

    if (!allTx || allTx.length === 0) {
      console.log("❌ No transactions found");
      return;
    }

    console.log(`📊 Total Transactions: ${allTx.length}\n`);

    // Separate by type
    const deposits = allTx.filter(tx => tx.transaction_type === 'deposit');
    const charges = allTx.filter(tx => tx.transaction_type === 'charge');
    const settlements = allTx.filter(tx => tx.transaction_type === 'settled');
    const withdrawals = allTx.filter(tx => tx.transaction_type === 'withdrawal');
    const commissions = allTx.filter(tx => tx.transaction_type === 'commission');

    console.log("📋 DEPOSITS:");
    console.log("-".repeat(80));
    let totalDeposits = 0;
    deposits.forEach((tx, idx) => {
      totalDeposits += Number(tx.amount);
      console.log(`${idx + 1}. Amount: $${Number(tx.amount).toFixed(2)}`);
      console.log(`   ID: ${tx.id}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Date: ${tx.created_at}`);
      if (tx.admin_message) console.log(`   Message: ${tx.admin_message}`);
      if (tx.strategy_id) console.log(`   Strategy: ${tx.strategy_id}`);
      console.log("");
    });
    console.log(`Total Deposits: $${totalDeposits.toFixed(2)}\n`);

    console.log("💳 CHARGES (Investment Increases):");
    console.log("-".repeat(80));
    let totalCharges = 0;
    charges.forEach((tx, idx) => {
      totalCharges += Number(tx.amount);
      console.log(`${idx + 1}. Amount: $${Number(tx.amount).toFixed(2)}`);
      console.log(`   ID: ${tx.id}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Date: ${tx.created_at}`);
      if (tx.admin_message) console.log(`   Message: ${tx.admin_message}`);
      console.log("");
    });
    console.log(`Total Charges: $${totalCharges.toFixed(2)}\n`);

    console.log("🔄 SETTLEMENTS (Investment Reductions):");
    console.log("-".repeat(80));
    let totalSettlements = 0;
    settlements.forEach((tx, idx) => {
      totalSettlements += Number(tx.amount);
      console.log(`${idx + 1}. Amount: $${Number(tx.amount).toFixed(2)}`);
      console.log(`   ID: ${tx.id}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Date: ${tx.created_at}`);
      if (tx.admin_message) console.log(`   Message: ${tx.admin_message}`);
      console.log("");
    });
    console.log(`Total Settlements: $${totalSettlements.toFixed(2)}\n`);

    if (withdrawals.length > 0) {
      console.log("🚀 WITHDRAWALS:");
      console.log("-".repeat(80));
      let totalWithdrawals = 0;
      withdrawals.forEach((tx, idx) => {
        totalWithdrawals += Number(tx.amount);
        console.log(`${idx + 1}. Amount: $${Number(tx.amount).toFixed(2)}`);
        console.log(`   ID: ${tx.id}`);
        console.log(`   Date: ${tx.created_at}`);
        console.log("");
      });
      console.log(`Total Withdrawals: $${totalWithdrawals.toFixed(2)}\n`);
    }

    if (commissions.length > 0) {
      console.log("💰 COMMISSIONS:");
      console.log("-".repeat(80));
      let totalCommissions = 0;
      commissions.forEach((tx, idx) => {
        totalCommissions += Number(tx.amount);
        console.log(`${idx + 1}. Amount: $${Number(tx.amount).toFixed(2)}`);
        console.log(`   ID: ${tx.id}`);
        console.log(`   Date: ${tx.created_at}`);
        if (tx.admin_message) console.log(`   Message: ${tx.admin_message}`);
        console.log("");
      });
      console.log(`Total Commissions: $${totalCommissions.toFixed(2)}\n`);
    }

    // Calculate balance
    console.log("💹 BALANCE CALCULATION:");
    console.log("-".repeat(80));
    const balance = totalDeposits - totalCharges + totalSettlements - (withdrawals.reduce((sum, tx) => sum + Number(tx.amount), 0)) + (commissions.reduce((sum, tx) => sum + Number(tx.amount), 0));
    
    console.log(`Deposits:        +$${totalDeposits.toFixed(2)}`);
    console.log(`Charges:         -$${totalCharges.toFixed(2)}`);
    console.log(`Settlements:     +$${totalSettlements.toFixed(2)}`);
    if (withdrawals.length > 0) console.log(`Withdrawals:     -$${withdrawals.reduce((sum, tx) => sum + Number(tx.amount), 0).toFixed(2)}`);
    if (commissions.length > 0) console.log(`Commissions:     +$${commissions.reduce((sum, tx) => sum + Number(tx.amount), 0).toFixed(2)}`);
    console.log("-".repeat(80));
    console.log(`Current Balance: $${balance.toFixed(2)}\n`);

    // Check if there's any $8500 related transaction
    console.log("🔎 SEARCHING FOR $8500 REFERENCES:");
    console.log("-".repeat(80));
    const eightFiveHundred = allTx.filter(tx => 
      Math.abs(Number(tx.amount) - 8500) < 0.01 || 
      (tx.admin_message && tx.admin_message.includes('8500'))
    );
    
    if (eightFiveHundred.length > 0) {
      console.log(`Found ${eightFiveHundred.length} transaction(s) related to $8500:\n`);
      eightFiveHundred.forEach((tx) => {
        console.log(`ID: ${tx.id}`);
        console.log(`Amount: $${Number(tx.amount).toFixed(2)}`);
        console.log(`Type: ${tx.transaction_type}`);
        console.log(`Date: ${tx.created_at}`);
        console.log(`Message: ${tx.admin_message || 'N/A'}\n`);
      });
    } else {
      console.log("❌ No transactions exactly matching $8500 found.");
      console.log("   The $8500 might be a calculation based on investments,");
      console.log("   a running strategy capital, or a display value.\n");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.release();
    await pool.end();
  }
}

analyzeTransactions().catch(console.error);
