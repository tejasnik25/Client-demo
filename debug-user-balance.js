/**
 * Debug script to find the problematic transaction for user_1775738809201
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

async function debugUserBalance() {
  const connection = await pool.getConnection();
  try {
    console.log("🔍 Looking for user_1775738809201 transactions...\n");

    // Get all transactions for this user
    const [transactions] = await connection.execute(
      `SELECT id, amount, transaction_type, status, created_at, admin_message 
       FROM wallet_transactions 
       WHERE user_id = ? 
       ORDER BY created_at DESC
       LIMIT 20`,
      ["user_1775738809201"]
    );

    if (!transactions || transactions.length === 0) {
      console.log("❌ No transactions found for this user.");
      return;
    }

    console.log(`📋 Recent transactions (${transactions.length}):\n`);
    transactions.forEach((tx, idx) => {
      console.log(`${idx + 1}. ID: ${tx.id}`);
      console.log(`   Amount: $${tx.amount}`);
      console.log(`   Type: ${tx.transaction_type}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Created: ${tx.created_at}`);
      if (tx.admin_message) console.log(`   Message: ${tx.admin_message}`);
      console.log("");
    });

    // Calculate current balance
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

    const currentBalance = Number(balanceResult[0]?.balance || 0);
    console.log(`💰 Current Balance: $${currentBalance.toFixed(2)}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.release();
    await pool.end();
  }
}

debugUserBalance().catch(console.error);
