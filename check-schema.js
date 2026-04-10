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
    
    console.log('\n=== USERS TABLE SCHEMA ===');
    const [usersSchema] = await conn.query(`DESCRIBE users`);
    console.log(usersSchema);
    
    console.log('\n=== PAYMENTS TABLE SCHEMA ===');
    const [paymentsSchema] = await conn.query(`DESCRIBE payments`);
    console.log(paymentsSchema);
    
    console.log('\n=== STRATEGIES TABLE SCHEMA ===');
    const [strategiesSchema] = await conn.query(`DESCRIBE strategies`);
    console.log(strategiesSchema);
    
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

check();
