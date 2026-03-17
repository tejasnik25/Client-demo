import mysql from 'mysql2/promise';
import { config } from 'dotenv';

// Avoid loading .env in production/serverless (can produce noisy logs).
if (process.env.NODE_ENV !== 'production') {
  config();
}

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
  maxIdle: 2, // Close idle connections to prevent server-side timeouts
  idleTimeout: 30000, // 30s idle timeout
  queueLimit: 0,
  connectTimeout: 20000, // Reduced from 120s to fail faster
  enableKeepAlive: true,
  keepAliveInitialDelay: 0, // Send keepalive immediately
  ...(sslConfig ? { ssl: sslConfig as any } : {}),
});

export default pool;
