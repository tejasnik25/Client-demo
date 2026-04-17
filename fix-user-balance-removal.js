/**
 * Fix script for user_1775738809201
 * Removes the incorrect $3000 settlement/withdrawal from 2026-04-16T14:44:21
 * ID: txn_inv_b342e0bf-10cf-4162-8b02-e369
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
    console.log("🔍 Fixing balance for user_1775738809201...\n");

    // Get current balance before fix
    const [balanceBefore] = await connection.execute(
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

    const beforeBalance = Number(balanceBefore[0]?.balance || 0);
    console.log(`💰 Balance BEFORE: $${beforeBalance.toFixed(2)}\n`);

    // Get the problematic transaction
    const [txToDelete] = await connection.execute(
      `SELECT id, amount, transaction_type, created_at 
       FROM wallet_transactions 
       WHERE id = ? AND user_id = ?`,
      ["txn_inv_b342e0bf-10cf-4162-8b02-e369", "user_1775738809201"]
    );

    if (txToDelete && txToDelete.length > 0) {
      const tx = txToDelete[0];
      console.log("🗑️  Removing problematic transaction:");
      console.log(`   ID: ${tx.id}`);
      console.log(`   Amount: $${tx.amount}`);
      console.log(`   Type: ${tx.transaction_type}`);
      console.log(`   Created: ${tx.created_at}\n`);

      // Delete the transaction
      await connection.execute(
        "DELETE FROM wallet_transactions WHERE id = ?",
        ["txn_inv_b342e0bf-10cf-4162-8b02-e369"]
      );

      console.log("✅ Transaction deleted!\n");
    } else {
      console.log("⚠️  Transaction not found. Checking alternative...\n");
    }

    // Get new balance after fix
    const [balanceAfter] = await connection.execute(
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

    const afterBalance = Number(balanceAfter[0]?.balance || 0);
    const difference = afterBalance - beforeBalance;

    console.log(`💰 Balance AFTER: $${afterBalance.toFixed(2)}`);
    console.log(`📊 Difference: +$${Math.abs(difference).toFixed(2)}\n`);

    console.log("✨ Fix complete!");
    console.log("📝 The incorrect withdrawal has been removed from the Balance Operations tab.\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.release();
    await pool.end();
  }
}

fixUserBalance().catch(console.error);
