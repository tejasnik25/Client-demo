const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local or .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function runMigration() {
  console.log('Starting migration...');
  
  const connectionConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stock_analysis_db',
    port: parseInt(process.env.DB_PORT || '3306'),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  };

  console.log('Connecting to database:', connectionConfig.host, connectionConfig.database);

  let connection;
  try {
    connection = await mysql.createConnection(connectionConfig);
    console.log('Connected.');

    const columnsToAdd = [
      { name: 'roi', type: 'DECIMAL(10, 2)' },
      { name: 'profit', type: 'DECIMAL(10, 2)' },
      { name: 'max_ddi', type: 'DECIMAL(10, 2)' },
      { name: 'copiers', type: 'INT' },
      { name: 'masters_tag', type: 'VARCHAR(255)' },
      { name: 'icon_blob', type: 'LONGBLOB' },
      { name: 'icon_mime', type: 'VARCHAR(255)' }
    ];

    for (const col of columnsToAdd) {
      try {
        // Check if column exists
        const [rows] = await connection.execute(
          `SELECT count(*) as count FROM information_schema.columns 
           WHERE table_schema = ? AND table_name = 'strategies' AND column_name = ?`,
          [connectionConfig.database, col.name]
        );
        
        if (rows[0].count === 0) {
          console.log(`Adding column ${col.name}...`);
          await connection.execute(`ALTER TABLE strategies ADD COLUMN ${col.name} ${col.type}`);
          console.log(`Added column ${col.name}.`);
        } else {
          console.log(`Column ${col.name} already exists.`);
        }
      } catch (err) {
        console.error(`Error adding column ${col.name}:`, err.message);
      }
    }

    console.log('Migration completed.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();
