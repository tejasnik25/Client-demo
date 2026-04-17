/**
 * Fix lot size for user_1775738809201
 * Correct it from 1.0000 to 3.5432 based on $3543.20 investment
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

async function fixLotSize() {
  const connection = await pool.getConnection();
  try {
    console.log("🔧 FIXING LOT SIZE FOR user_1775738809201\n");
    console.log("=" .repeat(80) + "\n");

    const runningStrategyId = "rs_1775760184935_822kbr";
    const correctLotSize = 3.5432; // $3543.20 / $1000 per lot

    // Get current state
    const [before] = await connection.execute(
      `SELECT rs.lot_size, rs.capital, s.name
       FROM running_strategies rs
       LEFT JOIN strategies s ON rs.strategy_id = s.id
       WHERE rs.id = ?`,
      [runningStrategyId]
    );

    if (!before || before.length === 0) {
      console.log("❌ Running strategy not found");
      return;
    }

    const current = before[0];
    console.log("📊 BEFORE:");
    console.log(`  Strategy: ${current.name}`);
    console.log(`  Lot Size: ${Number(current.lot_size || 1).toFixed(4)}`);
    console.log(`  Capital in Strategy: $${Number(current.capital).toFixed(2)}\n`);

    // Update lot size
    console.log("🔄 UPDATING...\n");
    await connection.execute(
      `UPDATE running_strategies 
       SET lot_size = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [correctLotSize, runningStrategyId]
    );

    // Get updated state
    const [after] = await connection.execute(
      `SELECT rs.lot_size, rs.capital, s.name
       FROM running_strategies rs
       LEFT JOIN strategies s ON rs.strategy_id = s.id
       WHERE rs.id = ?`,
      [runningStrategyId]
    );

    const updated = after[0];
    console.log("📊 AFTER:");
    console.log(`  Strategy: ${updated.name}`);
    console.log(`  Lot Size: ${Number(updated.lot_size).toFixed(4)} ✅`);
    console.log(`  Capital in Strategy: $${Number(updated.capital).toFixed(2)}\n`);

    console.log("=" .repeat(80));
    console.log("\n✨ LOT SIZE CORRECTED!\n");
    console.log("📝 Summary:");
    console.log(`  Old lot size: 1.0000`);
    console.log(`  New lot size: ${Number(updated.lot_size).toFixed(4)}`);
    console.log(`  Based on investment: $3,543.20`);
    console.log(`  Lot unit price: $1,000.00`);
    console.log(`  Calculation: $3,543.20 ÷ $1,000 = ${correctLotSize.toFixed(4)} lots\n`);

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.release();
    await pool.end();
  }
}

fixLotSize().catch(console.error);
