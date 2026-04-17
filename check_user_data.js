const mysql = require('mysql2/promise');
const pool = mysql.createPool({ 
  host: 'stock-analysis-db.cx8ioemygq4m.ap-south-1.rds.amazonaws.com', 
  user: 'admin', 
  password: 'Client_demo_25', 
  database: 'stock_analysis_db' 
});
(async () => {
  try {
    const [rows] = await pool.execute('SELECT * FROM wallet_transactions WHERE user_id = "user_1775738809201"');
    console.log("WALLET TRANSACTIONS:");
    console.log(JSON.stringify(rows, null, 2));
    
    const [rsRows] = await pool.execute('SELECT * FROM running_strategies WHERE user_id = "user_1775738809201"');
    console.log("RUNNING STRATEGIES:");
    console.log(JSON.stringify(rsRows, null, 2));

    const [settlements] = await pool.execute('SELECT * FROM profit_settlement_items WHERE user_id = "user_1775738809201"');
    console.log("SETTLEMENT ITEMS:");
    console.log(JSON.stringify(settlements, null, 2));
  } finally {
    await pool.end();
  }
})()
