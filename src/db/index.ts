import mysql from 'mysql2/promise';
import { config } from 'dotenv';

// Load env in non-Next runtimes (safe in Next too)
config();

// Optional TLS/SSL support via envs
const useSSL = (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1');
const rejectUnauthorized = (process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' || process.env.DB_SSL_REJECT_UNAUTHORIZED === '1');
const sslConfig = useSSL ? { rejectUnauthorized } : undefined;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_NAME || 'stock_analysis_db',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  ...(sslConfig ? { ssl: sslConfig as any } : {}),
});

export const db = pool;