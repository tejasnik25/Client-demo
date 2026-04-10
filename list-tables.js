const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'admin',
  database: 'stock_analysis_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function check() {
  try {
    const conn = await pool.getConnection();
    
    console.log('\n=== ALL TABLES IN DATABASE ===');
    const [tables] = await conn.query(`SHOW TABLES`);
    console.table(tables);
    
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

check();
