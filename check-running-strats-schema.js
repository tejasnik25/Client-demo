/**
 * Check running_strategies table schema
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

async function checkSchema() {
  const connection = await pool.getConnection();
  try {
    console.log("🔍 CHECKING running_strategies TABLE SCHEMA\n");

    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'running_strategies'
       ORDER BY ORDINAL_POSITION`
    );

    console.log("📋 Columns in running_strategies:\n");
    columns.forEach((col, idx) => {
      console.log(`${idx + 1}. ${col.COLUMN_NAME}`);
      console.log(`   Type: ${col.DATA_TYPE}`);
      console.log(`   Nullable: ${col.IS_NULLABLE}`);
      if (col.COLUMN_KEY) console.log(`   Key: ${col.COLUMN_KEY}`);
      if (col.EXTRA) console.log(`   Extra: ${col.EXTRA}`);
      console.log("");
    });

    // Check if lot_size column exists
    const hasLotSize = columns.some(col => col.COLUMN_NAME === 'lot_size');
    if (!hasLotSize) {
      console.log("⚠️  lot_size column NOT FOUND");
      console.log("    Need to add it to the table\n");
    } else {
      console.log("✅ lot_size column EXISTS\n");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.release();
    await pool.end();
  }
}

checkSchema().catch(console.error);
