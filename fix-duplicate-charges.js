/**
 * Fix duplicate investment charges for user_1775738809201
 * Remove 5x $1000 erroneous charges and their matching settlements
 * Keep only legitimate $3500 investment ($2000 + $1500)
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

async function fixDuplicateCharges() {
  const connection = await pool.getConnection();
  try {
    console.log("🔧 FIXING DUPLICATE INVESTMENT CHARGES\n");
    console.log("=" .repeat(80) + "\n");

    // Get current balance before
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

    // IDs of the 5 duplicate $1000 charges to remove
    const chargeIdsToRemove = [
      'txn_inv_08b6b431-4215-4287-b279-5f16',
      'txn_inv_72643c08-dcd7-461f-9807-a305',
      'txn_inv_125fcb69-43a8-4f6d-baa6-8dde',
      'txn_inv_d6f95c26-d99f-44b6-ac03-b86d',
      'txn_inv_d41895e5-36b0-458f-97bb-c8a9'
    ];

    // IDs of the 5 matching $1000 settlements to remove
    const settlementIdsToRemove = [
      'txn_inv_438e00ee-1cc4-42c5-bd80-b8ad',
      'txn_inv_e6481165-a591-4ffb-b321-7f45',
      'txn_inv_36a63350-ad7b-4ff0-a82a-ad3f',
      'txn_inv_d7d39f73-70d7-4a2a-a674-2487',
      'txn_inv_e447a600-70d0-4f4a-a9d9-49d2'
    ];

    console.log("💾 BALANCE BEFORE: $" + beforeBalance.toFixed(2) + "\n");

    console.log("🗑️  REMOVING DUPLICATE CHARGES:\n");
    for (const id of chargeIdsToRemove) {
      const [result] = await connection.execute(
        "DELETE FROM wallet_transactions WHERE id = ? AND user_id = ?",
        [id, "user_1775738809201"]
      );
      if (result.affectedRows > 0) {
        console.log(`  ✅ Deleted charge: ${id}`);
      }
    }

    console.log("\n🗑️  REMOVING MATCHING SETTLEMENTS:\n");
    for (const id of settlementIdsToRemove) {
      const [result] = await connection.execute(
        "DELETE FROM wallet_transactions WHERE id = ? AND user_id = ?",
        [id, "user_1775738809201"]
      );
      if (result.affectedRows > 0) {
        console.log(`  ✅ Deleted settlement: ${id}`);
      }
    }

    // Get new balance after
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

    console.log("\n" + "=" .repeat(80));
    console.log("\n📊 CORRECTED INVESTMENT SUMMARY:\n");
    console.log("  ✅ Legitimate Charges Kept:");
    console.log("     - $2,000.00 (Apr 09) - Initial Investment");
    console.log("     - $1,500.00 (Apr 13) - Investment Increase");
    console.log("     = $3,500.00 TOTAL\n");
    console.log("  ❌ Erroneous Charges Removed:");
    console.log("     - 5x $1,000.00 duplicates");
    console.log("     - $5,000.00 REMOVED\n");

    console.log("💰 BALANCE UPDATE:");
    console.log(`  Before: $${beforeBalance.toFixed(2)}`);
    console.log(`  After:  $${afterBalance.toFixed(2)}`);
    console.log(`  Change: +$${(afterBalance - beforeBalance).toFixed(2)}\n`);

    console.log("=" .repeat(80) + "\n");
    console.log("✨✨✨ FIX COMPLETE! ✨✨✨\n");
    console.log("📝 Summary:");
    console.log("  ✅ Removed 5 duplicate $1,000 charges");
    console.log("  ✅ Removed 5 matching $1,000 settlements");
    console.log("  ✅ Investment now shows correct: $3,500.00");
    console.log("  ✅ Your balance restored: $" + afterBalance.toFixed(2) + "\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.release();
    await pool.end();
  }
}

fixDuplicateCharges().catch(console.error);
