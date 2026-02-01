const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function migrate() {
  console.log('Starting migration to add masters_tag column...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306'),
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Check if masters_tag column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'strategies' AND COLUMN_NAME = 'masters_tag'
    `, [process.env.DB_NAME]);

    if (columns.length === 0) {
      console.log('Adding masters_tag column...');
      await connection.execute(`
        ALTER TABLE strategies 
        ADD COLUMN masters_tag VARCHAR(255)
      `);
      console.log('Column masters_tag added successfully.');
    } else {
      console.log('Column masters_tag already exists.');
    }

    console.log('Migration completed.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

migrate();
