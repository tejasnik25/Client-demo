import { NextResponse } from 'next/server';
import pool from '@/db/db';

export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET(req: Request) {
  try {
    // Test DB Connection first
    try {
        await pool.query('SELECT 1');
    } catch (dbError: any) {
        console.error('DB Connection Check Failed:', dbError);
        return NextResponse.json({ 
            error: 'Database Connection Failed', 
            details: dbError.message,
            hint: 'Check if DB_HOST, DB_USER, DB_PASSWORD are set in Vercel Environment Variables'
        }, { status: 500 });
    }

    // 1. Fetch Strategies (Masters)
    // We select specific columns to avoid errors if the table structure varies slightly
    const [strategies]: any = await pool.query(
      `SELECT id, master_account_id, master_account_password, master_account_server, master_platform 
       FROM strategies 
       WHERE master_account_id IS NOT NULL AND master_account_id != ''`
    );

    // 2. Fetch Wallet Transactions (Slaves) - Completed only
    // Note: mt_account_server column is NOT in database_setup.sql, so we omit it to avoid SQL errors
    const [transactions]: any = await pool.query(
      `SELECT id, user_id, strategy_id, mt_account_id, mt_account_password, platform, status, created_at
       FROM wallet_transactions 
       WHERE status = 'completed'`
    );

    // 3. Format into Subscriptions
    const subs = [];
    const processedKeys = new Set();
    
    // Map strategies for easy lookup
    const stratMap = new Map();
    strategies.forEach((s: any) => stratMap.set(s.id, s));

    // Sort transactions by date (newest first) to prioritize latest subscription if duplicates exist
    transactions.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    for (const tx of transactions) {
        if (!tx.mt_account_id || !tx.mt_account_password) continue;
        
        // Note: strategy_id from wallet_transactions
        const strat = stratMap.get(tx.strategy_id);
        if (!strat) continue;
        
        const key = `${tx.user_id}_${tx.strategy_id}`;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);

        subs.push({
            id: `sub_${tx.user_id}_${tx.strategy_id}`,
            externalId: tx.id,
            master: {
                // Use snake_case fields from DB
                id: String(strat.master_account_id),
                password: strat.master_account_password,
                server: strat.master_account_server,
                platform: strat.master_platform || 'MT5'
            },
            slave: {
                id: String(tx.mt_account_id),
                password: tx.mt_account_password,
                server: tx.mt_account_server || 'MetaQuotes-Demo',
                platform: tx.platform || 'MT5'
            },
            settings: {
                riskType: "balance_multiplier",
                riskValue: 1.0
            }
        });
    }

    return NextResponse.json(subs);
  } catch (error: any) {
    console.error('Export Subscriptions Error:', error);
    return NextResponse.json({ 
        error: 'Internal Server Error', 
        details: error.message,
        stack: error.stack 
    }, { status: 500 });
  }
}
