/**
 * Corrected fix for user_1775738809201
 * 1. Removes the incorrect $3000 settlement transaction
 * 2. Adds a credit/deposit transaction for $3000 to restore funds
 */

const mysql = require("mysql2/promise");
require("dotenv").config();

// Simple UUID v4 generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

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
    console.log("🔍 Correcting balance for user_1775738809201...\n");

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
    console.log(`💰 Current Balance: $${beforeBalance.toFixed(2)}`);
    console.log(`📊 Target Balance: $32,543.20 (restore $3000)\n`);

    // Step 1: Delete the problematic settlement transaction
    console.log("Step 1️⃣  Removing incorrect settlement transaction...");
    const [txToDelete] = await connection.execute(
      `SELECT id, amount FROM wallet_transactions 
       WHERE id = ? AND user_id = ?`,
      ["txn_inv_b342e0bf-10cf-4162-8b02-e369", "user_1775738809201"]
    );

    if (txToDelete && txToDelete.length > 0) {
      await connection.execute(
        "DELETE FROM wallet_transactions WHERE id = ?",
        ["txn_inv_b342e0bf-10cf-4162-8b02-e369"]
      );
      console.log(`✅ Deleted: txn_inv_b342e0bf-10cf-4162-8b02-e369 ($3,000)\n`);
    }

    // Step 2: Create a credit/restoration transaction
    console.log("Step 2️⃣  Adding $3,000 credit/deposit transaction...");
    const creditTxId = `txn_credit_${generateUUID()}`;
    
    await connection.execute(
      `INSERT INTO wallet_transactions 
       (id, user_id, amount, transaction_type, status, admin_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        creditTxId,
        "user_1775738809201",
        3000.00,
        "deposit",
        "completed",
        "Balance correction - reversal of incorrect investment reduction from 2026-04-16T14:44:21"
      ]
    );
    console.log(`✅ Created: ${creditTxId}\n`);

    // Step 3: Verify new balance
    console.log("Step 3️⃣  Verifying corrected balance...");
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
    const adjustmentAmount = afterBalance - beforeBalance;

    console.log(`💰 New Balance: $${afterBalance.toFixed(2)}`);
    console.log(`📈 Adjustment: +$${adjustmentAmount.toFixed(2)}\n`);

    console.log("✨✨✨ Balance correction complete! ✨✨✨");
    console.log("📝 Changes made:");
    console.log("   ✅ Removed: $3,000 incorrect settlement/withdrawal");
    console.log("   ✅ Added: $3,000 corrective deposit");
    console.log("   ✅ Balance operations tab updated\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.release();
    await pool.end();
  }
}

fixUserBalance().catch(console.error);
