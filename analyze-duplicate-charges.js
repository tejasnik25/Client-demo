/**
 * Analyze and fix duplicate investment charges for user_1775738809201
 * User invested only $3500, but system shows $8500+ in charges
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

async function analyzeCharges() {
  const connection = await pool.getConnection();
  try {
    console.log("🔍 ANALYZING INVESTMENT CHARGES\n");
    console.log("=" .repeat(80) + "\n");

    // Get all CHARGE transactions for this user on Growth Momentum
    const [charges] = await connection.execute(
      `SELECT id, amount, transaction_type, status, created_at, admin_message, strategy_id
       FROM wallet_transactions 
       WHERE user_id = ? 
       AND transaction_type = 'charge'
       AND strategy_id = (SELECT id FROM strategies WHERE name = 'Growth Momentum' LIMIT 1)
       ORDER BY created_at ASC`,
      ["user_1775738809201"]
    );

    if (!charges || charges.length === 0) {
      console.log("❌ No charge transactions found");
      return;
    }

    console.log(`💳 ALL INVESTMENT CHARGES (${charges.length} total):\n`);
    let totalCharges = 0;
    charges.forEach((tx, idx) => {
      totalCharges += Number(tx.amount);
      console.log(`${idx + 1}. $${Number(tx.amount).toFixed(2)}`);
      console.log(`   ID: ${tx.id}`);
      console.log(`   Date: ${tx.created_at}`);
      console.log(`   Message: ${tx.admin_message || 'N/A'}`);
      console.log("");
    });

    console.log("=" .repeat(80));
    console.log(`\n💰 TOTAL CHARGES: $${totalCharges.toFixed(2)}`);
    console.log(`📊 Your Actual Investment: $3,500.00`);
    console.log(`❌ Over-charged: $${(totalCharges - 3500).toFixed(2)}\n`);

    console.log("=" .repeat(80) + "\n");
    console.log("📋 RECOMMENDED FIX:\n");
    console.log("Keep the legitimate charges totaling $3500:");
    console.log("  ✅ $2,000.00 (Apr 09, 18:43) - Initial investment");
    console.log("  ✅ $1,500.00 (Apr 13, 20:20) - Investment Increase");
    console.log("  Total: $3,500.00\n");
    
    console.log("Remove duplicate/erroneous charges:");
    let dupTotal = 0;
    let countDups = 0;
    charges.forEach((tx) => {
      if (Number(tx.amount) === 1000 || (Number(tx.amount) < 50 && Number(tx.amount) > 0)) {
        console.log(`  ❌ $${Number(tx.amount).toFixed(2)} (${tx.created_at}) - ID: ${tx.id.substr(0, 20)}...`);
        dupTotal += Number(tx.amount);
        countDups++;
      }
    });
    console.log(`\nTotal duplicates to remove: ${countDups} transactions worth $${dupTotal.toFixed(2)}\n`);

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.release();
    await pool.end();
  }
}

analyzeCharges().catch(console.error);
