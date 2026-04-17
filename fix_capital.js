const mysql = require('mysql2/promise');
const pool = mysql.createPool({ 
  host: 'stock-analysis-db.cx8ioemygq4m.ap-south-1.rds.amazonaws.com', 
  user: 'admin', 
  password: 'Client_demo_25', 
  database: 'stock_analysis_db' 
});
(async () => {
  try {
    const userId = "user_1775738809201";
    const strategyId = "strategy-1";
    const correctCapital = 2500.00;

    console.log(`Fixing capital for user ${userId}...`);
    const [result] = await pool.execute(
      'UPDATE running_strategies SET capital = ?, updated_at = NOW() WHERE user_id = ? AND strategy_id = ?',
      [correctCapital, userId, strategyId]
    );

    if (result.affectedRows > 0) {
      console.log(`Successfully updated capital to $${correctCapital}`);
    } else {
      console.log("No record updated. Please check user_id and strategy_id.");
    }

  } finally {
    await pool.end();
  }
})()
