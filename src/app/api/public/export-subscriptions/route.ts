import { NextResponse } from 'next/server';
import pool from '@/db/db';

export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET(req: Request) {
  try {
    // 1. Fetch Strategies (Masters)
    const [strategies]: any = await pool.query(
      `SELECT id, masterAccountId, masterAccountPassword, masterAccountServer, masterPlatform 
       FROM strategies 
       WHERE masterAccountId IS NOT NULL`
    );

    // 2. Fetch Wallet Transactions (Slaves) - Completed only
    // Note: We prioritize the latest transaction for a user-strategy pair if duplicates exist
    const [transactions]: any = await pool.query(
      `SELECT id, userId, strategyId, mt_account_id, mt_account_password, mt_account_server, platform, status, created_at
       FROM wallet_transactions 
       WHERE status = 'completed'
       ORDER BY created_at DESC`
    );

    // 3. Format into Subscriptions
    const subs = [];
    const processedKeys = new Set();
    
    // Map strategies for easy lookup
    const stratMap = new Map();
    strategies.forEach((s: any) => stratMap.set(s.id, s));

    for (const tx of transactions) {
        if (!tx.mt_account_id || !tx.mt_account_password) continue;
        
        const strat = stratMap.get(tx.strategyId);
        if (!strat) continue;
        
        const key = `${tx.userId}_${tx.strategyId}`;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);

        subs.push({
            id: `sub_${tx.userId}_${tx.strategyId}`,
            externalId: tx.id,
            master: {
                id: String(strat.masterAccountId),
                password: strat.masterAccountPassword,
                server: strat.masterAccountServer,
                platform: strat.masterPlatform || 'MT5'
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
