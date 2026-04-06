import { NextRequest, NextResponse } from 'next/server';
import pool from '@/db/db';

/**
 * POST /api/admin/diagnostic/cleanup
 * Cleans up duplicate running_strategies for user+strategy combo.
 * Keeps only the LATEST one (created_at DESC) and ensures it has correct capital.
 * 
 * Query params:
 * - userId: user ID to clean (default: user_1772105441338)
 * - strategyName: strategy name to match (default: Value%20Income)
 * - action: 'analyze' | 'cleanup' (default: analyze - shows what WOULD be deleted)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || 'user_1772105441338';
    const strategyName = request.nextUrl.searchParams.get('strategyName') || 'Value%20Income';
    const action = request.nextUrl.searchParams.get('action') || 'analyze'; // 'analyze' vs 'cleanup'

    console.log(`[Cleanup] Action: ${action}, userId: ${userId}, strategy: ${strategyName}`);

    // Find strategy ID
    const [strategies]: any = await pool.execute(
      'SELECT id, name FROM strategies WHERE name LIKE ? LIMIT 1',
      [`%${decodeURIComponent(strategyName)}%`]
    );

    if (!strategies.length) {
      return NextResponse.json({ error: `Strategy not found: ${strategyName}` }, { status: 400 });
    }

    const strategyId = strategies[0].id;
    const strategyFullName = strategies[0].name;

    // Get ALL running_strategies for this user+strategy (ordered by created_at DESC)
    const [allRunning]: any = await pool.execute(
      `SELECT id, capital, status, admin_status, created_at 
       FROM running_strategies 
       WHERE user_id = ? AND strategy_id = ? 
       ORDER BY created_at DESC`,
      [userId, strategyId]
    );

    console.log(`[Cleanup] Found ${allRunning.length} running_strategy records`);
    allRunning.forEach((r: any, idx: number) => {
      console.log(`  [${idx}] id: ${r.id}, capital: ${r.capital}, status: ${r.status}, admin_status: ${r.admin_status}, created: ${r.created_at}`);
    });

    if (allRunning.length === 0) {
      return NextResponse.json({
        message: 'No running strategies found',
        userId,
        strategyId,
        strategyName: strategyFullName
      });
    }

    if (allRunning.length === 1) {
      return NextResponse.json({
        message: 'Only 1 running_strategy exists (no cleanup needed)',
        userId,
        strategyId,
        strategyName: strategyFullName,
        current: allRunning[0]
      });
    }

    // Multiple exist - keep LATEST, delete rest
    const toKeep = allRunning[0]; // Latest
    const toDelete = allRunning.slice(1); // Older ones

    console.log(`[Cleanup] Will ${action === 'cleanup' ? 'DELETE' : 'preview delete'} ${toDelete.length} old running_strategies`);
    toDelete.forEach((r: any) => {
      console.log(`  [DELETE] ${r.id} (created: ${r.created_at}, capital: ${r.capital})`);
    });

    if (action === 'analyze') {
      // Just show what would happen
      return NextResponse.json({
        action: 'analyze',
        willDelete: toDelete.length,
        willKeep: toKeep.id,
        toDelete: toDelete.map((r: any) => ({
          id: r.id,
          capital: r.capital,
          status: r.status,
          admin_status: r.admin_status,
          created_at: r.created_at
        })),
        current: toKeep,
        userId,
        strategyId,
        strategyName: strategyFullName,
        nextStep: 'POST with action=cleanup to actually delete the old records'
      });
    }

    if (action === 'cleanup') {
      // Actually delete the old ones
      const deleteIds = toDelete.map((r: any) => r.id);
      let deleted = 0;
      let errors = [];

      for (const rsId of deleteIds) {
        try {
          // Delete related records first
          await pool.execute('DELETE FROM running_strategy_modifications WHERE running_strategy_id = ?', [rsId]);
          await pool.execute('DELETE FROM running_periods WHERE running_strategy_id = ?', [rsId]);
          await pool.execute('DELETE FROM disconnect_snapshots WHERE running_strategy_id = ?', [rsId]);
          
          // Unlink wallet transactions (don't delete, just unlink)
          await pool.execute(
            'UPDATE wallet_transactions SET running_strategy_id = NULL WHERE running_strategy_id = ?',
            [rsId]
          );

          // Delete the running_strategy itself
          const [result]: any = await pool.execute('DELETE FROM running_strategies WHERE id = ?', [rsId]);
          deleted += result.affectedRows || 0;
          console.log(`[Cleanup] Deleted running_strategy: ${rsId}`);
        } catch (err: any) {
          errors.push({ rsId, error: err.message });
          console.error(`[Cleanup] Failed to delete ${rsId}:`, err.message);
        }
      }

      return NextResponse.json({
        action: 'cleanup',
        deleted,
        errors,
        kept: toKeep.id,
        userId,
        strategyId,
        strategyName: strategyFullName,
        message: `Deleted ${deleted} old running_strategies. Kept latest: ${toKeep.id}`
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('[Cleanup] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
