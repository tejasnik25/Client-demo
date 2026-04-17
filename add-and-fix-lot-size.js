/**
 * Add lot_size column to running_strategies and set correct value
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

async function addAndFixLotSize() {
  const connection = await pool.getConnection();
  try {
    console.log("🔧 ADDING AND FIXING LOT SIZE COLUMN\n");
    console.log("=" .repeat(80) + "\n");

    console.log("Step 1️⃣  Adding lot_size column to running_strategies table...\n");
    
    try {
      await connection.execute(
        `ALTER TABLE running_strategies 
         ADD COLUMN lot_size DECIMAL(10, 4) DEFAULT 1.0000 AFTER capital`
      );
      console.log("  ✅ Column added successfully\n");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log("  ℹ️  Column already exists\n");
      } else {
        throw e;
      }
    }

    console.log("Step 2️⃣  Setting correct lot size for user_1775738809201...\n");

    const runningStrategyId = "rs_1775760184935_822kbr";
    const correctLotSize = 3.5432;

    // Get current state
    const [before] = await connection.execute(
      `SELECT rs.lot_size, rs.capital, s.name
       FROM running_strategies rs
       LEFT JOIN strategies s ON rs.strategy_id = s.id
       WHERE rs.id = ?`,
      [runningStrategyId]
    );

    if (!before || before.length === 0) {
      console.log("  ❌ Running strategy not found\n");
      return;
    }

    const current = before[0];
    console.log("  Current values:");
    console.log(`    Strategy: ${current.name}`);
    console.log(`    Lot Size: ${Number(current.lot_size || 1).toFixed(4)}`);
    console.log(`    Capital: $${Number(current.capital).toFixed(2)}\n`);

    // Update lot size
    console.log("  Updating lot size...\n");
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
    console.log("  Updated values:");
    console.log(`    Strategy: ${updated.name}`);
    console.log(`    Lot Size: ${Number(updated.lot_size).toFixed(4)} ✅`);
    console.log(`    Capital: $${Number(updated.capital).toFixed(2)}\n`);

    console.log("=" .repeat(80));
    console.log("\n✨ LOT SIZE FIXED!\n");
    console.log("📊 Summary:");
    console.log(`  Previous lot size: 1.0000`);
    console.log(`  New lot size: ${correctLotSize.toFixed(4)}`);
    console.log(`  Calculation: $3,543.20 ÷ $1,000.00 per lot = ${correctLotSize.toFixed(4)} lots`);
    console.log(`  Based on: $2,000 + $1,500 ($43.20 in small amounts)\n`);

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.release();
    await pool.end();
  }
}

addAndFixLotSize().catch(console.error);
