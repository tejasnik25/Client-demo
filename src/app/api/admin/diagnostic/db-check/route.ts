import { NextRequest, NextResponse } from 'next/server';
import pool from '@/db/db';

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || 'user_1772105441338';
    const strategyName = request.nextUrl.searchParams.get('strategyName') || 'Value Income';

    // Find strategy ID by name
    const [strategies]: any = await pool.execute(
      'SELECT id, name FROM strategies WHERE name LIKE ? LIMIT 5',
      [`%${strategyName}%`]
    );

    if (!strategies.length) {
      return NextResponse.json({ error: `Strategy with name "${strategyName}" not found` }, { status: 400 });
    }

    const strategyId = strategies[0].id;
    const strategyFullName = strategies[0].name;

    console.log(`[Diagnostic] Checking userId=${userId}, strategyId=${strategyId}`);

    // Check if running_strategy_id column exists
    const [columns]: any = await pool.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'wallet_transactions' AND TABLE_SCHEMA = DATABASE()
      AND COLUMN_NAME = 'running_strategy_id'
    `);
    
    const hasRunningStrategyIdColumn = columns.length > 0;

    // Get all running strategies for this user + strategy
    const [runningStrategies]: any = await pool.execute(
      `SELECT id, capital, status, admin_status, created_at, updated_at 
       FROM running_strategies 
       WHERE user_id = ? AND strategy_id = ? 
       ORDER BY created_at DESC`,
      [userId, strategyId]
    );

    // Get all wallet transactions for this user + strategy (with running_strategy_id if column exists)
    let transactions: any[] = [];
    if (hasRunningStrategyIdColumn) {
      const [txns]: any = await pool.execute(
        `SELECT id, created_at, transaction_type, amount, capital, status, running_strategy_id 
         FROM wallet_transactions 
         WHERE user_id = ? AND strategy_id = ? 
         ORDER BY created_at DESC`,
        [userId, strategyId]
      );
      transactions = txns;
    } else {
      const [txns]: any = await pool.execute(
        `SELECT id, created_at, transaction_type, amount, capital, status
         FROM wallet_transactions 
         WHERE user_id = ? AND strategy_id = ? 
         ORDER BY created_at DESC`,
        [userId, strategyId]
      );
      transactions = txns.map((t: any) => ({ ...t, running_strategy_id: null }));
    }

    // Group transactions by date
    const txnsByDate: Record<string, any[]> = {};
    transactions.forEach((t: any) => {
      const date = new Date(t.created_at).toLocaleDateString();
      if (!txnsByDate[date]) txnsByDate[date] = [];
      txnsByDate[date].push(t);
    });

    // Analyze the issue
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!hasRunningStrategyIdColumn) {
      issues.push('CRITICAL: running_strategy_id column does NOT exist in wallet_transactions table!');
    }

    if (runningStrategies.length > 1) {
      const activeCount = runningStrategies.filter((r: any) => 
        (r.admin_status?.toLowerCase() === 'running' || r.status?.toLowerCase() === 'active')
      ).length;
      if (activeCount > 1) {
        issues.push(`CRITICAL: ${activeCount} ACTIVE running_strategies found! Should only have 1.`);
        runningStrategies.forEach((r: any, idx: number) => {
          console.log(`  [RS ${idx}] id=${r.id}, capital=${r.capital}, status=${r.status}, admin_status=${r.admin_status}, created=${r.created_at}`);
        });
      }
    }

    // Check for unlinked transactions
    const unlinkedTxns = transactions.filter((t: any) => !t.running_strategy_id && t.status === 'completed');
    if (unlinkedTxns.length > 0) {
      warnings.push(`${unlinkedTxns.length} completed transactions are NOT linked to any running_strategy_id`);
    }

    // Check for duplicate deposits on the same day
    Object.entries(txnsByDate).forEach(([date, txns]) => {
      const deposits = txns.filter((t: any) => t.transaction_type === 'deposit');
      if (deposits.length > 1) {
        warnings.push(`${deposits.length} DEPOSIT transactions on ${date} - may indicate duplicate payments`);
      }
    });

    // Check for old transactions (before the most recent running_strategy)
    if (runningStrategies.length > 0) {
      const latestRS = runningStrategies[0];
      const oldTxns = transactions.filter((t: any) => new Date(t.created_at) < new Date(latestRS.created_at));
      if (oldTxns.length > 0) {
        const oldDeposits = oldTxns.filter((t: any) => t.transaction_type === 'deposit');
        if (oldDeposits.length > 0) {
          if (oldTxns.some((t: any) => !t.running_strategy_id)) {
            warnings.push(`${oldDeposits.length} OLD unlinked deposits found (created before latest running_strategy)`);
          }
        }
      }
    }

    return NextResponse.json({
      schemaOk: hasRunningStrategyIdColumn,
      analysis: {
        issues,
        warnings,
        userId,
        strategyId,
        strategyName: strategyFullName
      },
      data: {
        runningStrategies: runningStrategies.map((r: any) => ({
          id: r.id,
          capital: r.capital,
          status: r.status,
          admin_status: r.admin_status,
          created_at: r.created_at,
          updated_at: r.updated_at
        })),
        transactionsByDate: Object.entries(txnsByDate).reduce((acc: any, [date, txns]) => {
          acc[date] = txns.map((t: any) => ({
            id: t.id?.substring(0, 8),
            type: t.transaction_type,
            amount: t.amount,
            capital: t.capital,
            status: t.status,
            running_strategy_id: t.running_strategy_id?.substring(0, 8) || 'NULL',
            created_at: new Date(t.created_at).toLocaleTimeString()
          }));
          return acc;
        }, {})
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Diagnostic] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
