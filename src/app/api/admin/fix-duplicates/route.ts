import { NextResponse } from 'next/server';
import pool from '@/db/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Find user/strategy pairs with duplicates
    const [rows]: any = await pool.query(`
      SELECT user_id, strategy_id, COUNT(*) as cnt 
      FROM running_strategies 
      GROUP BY user_id, strategy_id 
      HAVING cnt > 1
    `);

    let deletedCount = 0;
    const details = [];

    for (const row of rows) {
      const { user_id, strategy_id } = row;
      
      // 2. Get all entries for this pair
      const [entries]: any = await pool.query(`
        SELECT id, status, admin_status, created_at 
        FROM running_strategies 
        WHERE user_id = ? AND strategy_id = ? 
      `, [user_id, strategy_id]);

      if (entries.length > 1) {
        // Sort to find the best one to keep
        entries.sort((a: any, b: any) => {
            // Define priority statuses
            const isPriority = (s: any) => ['active', 'running', 'in-process'].includes(s?.status) || ['active', 'running', 'in-process'].includes(s?.admin_status);
            
            const aPri = isPriority(a);
            const bPri = isPriority(b);
            
            if (aPri && !bPri) return -1;
            if (!aPri && bPri) return 1;
            
            // If both priority or both not, pick newest
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        const toKeep = entries[0];
        const toDelete = entries.slice(1);
        const idsToDelete = toDelete.map((e: any) => e.id);
        
        if (idsToDelete.length > 0) {
           for (const id of idsToDelete) {
               await pool.query(`DELETE FROM running_strategies WHERE id = ?`, [id]);
               await pool.query(`DELETE FROM running_strategy_modifications WHERE running_strategy_id = ?`, [id]);
           }
           
           deletedCount += idsToDelete.length;
           details.push({
               kept: toKeep.id,
               deleted: idsToDelete
           });
        }
      }
    }

    return NextResponse.json({ 
        success: true, 
        message: `Cleaned up ${deletedCount} duplicate strategies`,
        details 
    });
  } catch (error: any) {
    console.error('Cleanup failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
