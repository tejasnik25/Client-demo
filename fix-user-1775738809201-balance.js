/**
 * Fix script for user_1775738809201
 * Removes the incorrect withdrawal from 2026-04-16T14:44:21
 * This will restore the user's balance to the correct amount
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

async function fixUserBalance() {
  const connection = await pool.getConnection();
  try {
    console.log("⏳ Fetching user_1775738809201 wallet transactions...");

    // Find the incorrect withdrawal transaction
    const [transactions] = await connection.execute(
      `SELECT id, user_id, amount, transaction_type, status, created_at 
       FROM wallet_transactions 
       WHERE user_id = ? 
       AND transaction_type = 'withdrawal' 
       AND DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%S') LIKE '2026-04-16T14:44:21%'
       ORDER BY created_at DESC`,
      ["user_1775738809201"]
    );

    if (!transactions || transactions.length === 0) {
      console.log("❌ No matching withdrawal transaction found for the specified date.");
      return;
    }

    console.log(`\n📋 Found ${transactions.length} matching transaction(s):`);
    transactions.forEach((tx, idx) => {
      console.log(
        `${idx + 1}. ID: ${tx.id}, Amount: $${tx.amount}, Type: ${tx.transaction_type}, Status: ${tx.status}, Created: ${tx.created_at}`
      );
    });

    // Delete the incorrect withdrawal(s)
    console.log("\n🔄 Removing the incorrect withdrawal transaction...");

    for (const tx of transactions) {
      const [result] = await connection.execute(
        "DELETE FROM wallet_transactions WHERE id = ?",
        [tx.id]
      );

      console.log(`✅ Deleted transaction ID: ${tx.id}`);
      console.log(`   Amount removed: $${tx.amount}`);
    }

    // Calculate and display the corrected balance
    console.log("\n📊 Recalculating user balance...");
    const [balanceResult] = await connection.execute(
      `SELECT 
        SUM(CASE 
          WHEN transaction_type = 'deposit' AND status IN ('completed','settled','approved') THEN amount 
          WHEN transaction_type = 'charge' AND status IN ('completed','settled','approved') THEN -amount 
          WHEN transaction_type = 'withdrawal' AND status IN ('completed','settled','approved') THEN -amount 
          WHEN transaction_type = 'settled' AND status IN ('completed','settled','approved') THEN amount
          ELSE 0 END) as balance 
       FROM wallet_transactions 
       WHERE user_id = ?`,
      ["user_1775738809201"]
    );

    const newBalance = Number(balanceResult[0]?.balance || 0);
    console.log(`\n💰 User's corrected balance: $${newBalance.toFixed(2)}`);

    // Display remaining transactions
    const [remaining] = await connection.execute(
      `SELECT id, amount, transaction_type, status, created_at 
       FROM wallet_transactions 
       WHERE user_id = ? 
       AND status IN ('completed','settled','approved')
       ORDER BY created_at DESC`,
      ["user_1775738809201"]
    );

    console.log(`\n📝 Remaining valid transactions (${remaining.length}):`);
    remaining.forEach((tx) => {
      const sign = ["deposit", "charge", "settled"].includes(tx.transaction_type)
        ? "+"
        : "-";
      const displayAmount =
        tx.transaction_type === "charge" ? tx.amount : tx.amount;
      console.log(
        `   ${sign} $${displayAmount.toFixed(2)} - ${tx.transaction_type.toUpperCase()} (${tx.created_at})`
      );
    });

    console.log("\n✨ Fix complete! The user's balance has been corrected.");
  } catch (error) {
    console.error("❌ Error during fix:", error);
  } finally {
    await connection.release();
    await pool.end();
  }
}

// Run the fix
fixUserBalance().catch(console.error);
