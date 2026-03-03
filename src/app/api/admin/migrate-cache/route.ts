import { NextRequest, NextResponse } from 'next/server';
import pool from '@/db/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sql = `
      CREATE TABLE IF NOT EXISTS master_trades_cache (
        id INT AUTO_INCREMENT PRIMARY KEY,
        master_id VARCHAR(255) NOT NULL,
        position_id VARCHAR(255) NOT NULL,
        time_open TIMESTAMP NULL,
        time_close TIMESTAMP NULL,
        server_time_open VARCHAR(64),
        server_time_close VARCHAR(64),
        symbol VARCHAR(64),
        type VARCHAR(32),
        volume DECIMAL(14, 2),
        price_open DECIMAL(14, 5),
        price_close DECIMAL(14, 5),
        profit DECIMAL(14, 2),
        is_open BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_master_pos (master_id, position_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.query(sql);

    return NextResponse.json({ 
      success: true, 
      message: "Table 'master_trades_cache' has been verified/created successfully." 
    });
  } catch (error: any) {
    console.error('Migration failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
