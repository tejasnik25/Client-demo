import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import {
  getRunningStrategyById,
  createRunningStrategyModification,
} from '@/db/dbService';

type Params = { id: string };

/**
 * POST /api/running-strategies/[id]/modification
 * User requests a modification to their running strategy (e.g., disconnect/stop copying)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const rsId = params.id;
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'disconnect'; // 'disconnect', 'enable', 'connect', etc.

    // Get the running strategy and verify ownership
    const runningStrategy = await getRunningStrategyById(rsId);
    if (!runningStrategy) {
      return NextResponse.json(
        { success: false, error: 'Running strategy not found' },
        { status: 404 }
      );
    }

    if (runningStrategy.user_id !== session.user.id && runningStrategy.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - strategy belongs to different user' },
        { status: 403 }
      );
    }

    // Create a modification request
    const modId = `mod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const success = await createRunningStrategyModification({
      id: modId,
      running_strategy_id: rsId,
      user_id: session.user.id,
      status: 'in-process',
      new_update_json: { action }
    });

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to create modification request' },
        { status: 500 }
      );
    }

    console.log(`[ModificationRequest] User ${session.user.id} requested ${action} for running_strategy ${rsId}`);

    return NextResponse.json({
      success: true,
      message: `${action} request submitted and pending admin approval`,
      modificationId: modId
    });
  } catch (error) {
    console.error('[ModificationRequest] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
