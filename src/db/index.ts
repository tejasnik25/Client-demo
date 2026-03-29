import mysql from 'mysql2/promise';
import { config } from 'dotenv';

// Load env in non-Next runtimes (safe in Next too)
// Avoid loading .env in production/serverless (can produce noisy logs).
if (process.env.NODE_ENV !== 'production') {
  config();
}

// Optional TLS/SSL support via envs
const useSSL = (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1');
const rejectUnauthorized = (process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' || process.env.DB_SSL_REJECT_UNAUTHORIZED === '1');
const sslConfig = useSSL ? { rejectUnauthorized } : undefined;

const connectionLimit = process.env.DB_CONNECTION_LIMIT ? Number(process.env.DB_CONNECTION_LIMIT) : 30;

declare global {
  var __MYSQL_POOL__: mysql.Pool | undefined;
}

if (!global.__MYSQL_POOL__) {
  global.__MYSQL_POOL__ = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_NAME || 'stock_analysis_db',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    waitForConnections: true,
    connectionLimit: Number.isFinite(connectionLimit) ? connectionLimit : 30,
    queueLimit: 0,
    connectTimeout: 10000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    ...(sslConfig ? { ssl: sslConfig as any } : {}),
  });
}

export const db = global.__MYSQL_POOL__; 
export default global.__MYSQL_POOL__;