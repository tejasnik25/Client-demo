/**
 * Check and fix lot size calculation for user_1775738809201
 * Should be based on $3500 investment, not showing lot size = 1
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

async function checkLotSize() {
  const connection = await pool.getConnection();
  try {
    console.log("🔍 ANALYZING LOT SIZE ISSUE FOR user_1775738809201\n");
    console.log("=" .repeat(80) + "\n");

    // Get the running strategy
    const [runningStrats] = await connection.execute(
      `SELECT rs.*, s.name as strategy_name, s.parameters
       FROM running_strategies rs
       LEFT JOIN strategies s ON rs.strategy_id = s.id
       WHERE rs.user_id = ? AND s.name = 'Growth Momentum'`,
      ["user_1775738809201"]
    );

    if (!runningStrats || runningStrats.length === 0) {
      console.log("❌ Running strategy not found");
      return;
    }

    const rs = runningStrats[0];
    console.log("📊 RUNNING STRATEGY:");
    console.log(`  ID: ${rs.id}`);
    console.log(`  Strategy: ${rs.strategy_name}`);
    console.log(`  Capital: $${Number(rs.capital || 0).toFixed(2)}`);
    console.log(`  Lot Size (current): ${Number(rs.lot_size || 1).toFixed(4)}`);
    console.log(`  Status: ${rs.status}\n`);

    // Get strategy parameters
    const strategyParams = typeof rs.parameters === 'string' 
      ? JSON.parse(rs.parameters || '{}') 
      : rs.parameters || {};
    
    console.log("📋 STRATEGY PARAMETERS:");
    console.log(`  Lot Pricing: ${JSON.stringify(strategyParams.lotPricing, null, 2)}`);
    console.log(`  Unit Price: $${strategyParams.unitPrice || 'not set'}`);
    console.log(`  Lot Size Config: ${strategyParams.lotSize || 'not set'}\n`);

    // Get investment amounts
    const [deposits] = await connection.execute(
      `SELECT SUM(amount) as total_investment 
       FROM wallet_transactions 
       WHERE user_id = ? AND transaction_type = 'charge' AND status IN ('completed', 'approved')`,
      ["user_1775738809201"]
    );
    
    const totalInvestment = Number(deposits[0]?.total_investment || 0);
    console.log("💰 INVESTMENT ANALYSIS:");
    console.log(`  Total Investment: $${totalInvestment.toFixed(2)}\n`);

    // Calculate correct lot size
    console.log("🧮 LOT SIZE CALCULATION:");
    let correctLotSize = 1;
    let unitPrice = 1000; // Default unit price

    if (strategyParams.lotPricing && Array.isArray(strategyParams.lotPricing)) {
      // Extract unit price from lot pricing (usually the 1-lot price)
      const oneLotPrice = strategyParams.lotPricing.find(p => p.lot === 1);
      if (oneLotPrice) {
        unitPrice = Number(oneLotPrice.amountUSD);
        console.log(`  Unit Price (1 lot): $${unitPrice.toFixed(2)}`);
      } else if (strategyParams.lotPricing.length > 0) {
        const firstTier = strategyParams.lotPricing[0];
        unitPrice = Number(firstTier.amountUSD) / Number(firstTier.lot);
        console.log(`  Unit Price (calculated): $${unitPrice.toFixed(2)}`);
      }
    }

    correctLotSize = totalInvestment / unitPrice;
    console.log(`  Formula: $${totalInvestment.toFixed(2)} ÷ $${unitPrice.toFixed(2)} = ${correctLotSize.toFixed(4)} lots\n`);

    console.log("=" .repeat(80));
    console.log("\n⚠️  LOT SIZE ISSUE FOUND:");
    console.log(`  Current Lot Size: ${Number(rs.lot_size || 1).toFixed(4)}`);
    console.log(`  Correct Lot Size: ${correctLotSize.toFixed(4)}`);
    console.log(`  Discrepancy: ${Math.abs(correctLotSize - Number(rs.lot_size || 1)).toFixed(4)} lots\n`);

    if (Math.abs(correctLotSize - Number(rs.lot_size || 1)) > 0.01) {
      console.log("✅ RECOMMENDATION:");
      console.log(`  Update lot_size from ${Number(rs.lot_size || 1).toFixed(4)} to ${correctLotSize.toFixed(4)}`);
      console.log(`\n  Running Strategy ID: ${rs.id}\n`);
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await connection.release();
    await pool.end();
  }
}

checkLotSize().catch(console.error);
