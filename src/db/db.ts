import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

const isVercel = !!process.env.VERCEL;
const useSSL = process.env.DB_SSL ? (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1') : isVercel;
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED ? (process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' || process.env.DB_SSL_REJECT_UNAUTHORIZED === '1') : false;
const sslConfig = useSSL ? { rejectUnauthorized } : undefined;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_NAME || 'stock_analysis_db',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  connectTimeout: 120000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  ...(sslConfig ? { ssl: sslConfig as any } : {}),
});

export default pool;
