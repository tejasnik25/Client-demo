import { NextRequest, NextResponse } from 'next/server';
import { getAllStrategies, createStrategy, updateStrategy, deleteStrategy } from '../../../db/dbService';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';

/**
 * GET /api/strategies
 * Get all strategies for users
 */
export async function GET() {
  try {
    const strategies = await getAllStrategies();
    return NextResponse.json({ strategies });
  } catch (error) {
    console.error('Error fetching strategies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch strategies' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/strategies
 * Create a new strategy (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, description, imageUrl, details, enabled, contentType, contentUrl, minCapital, avgDrawdown, riskReward, winStreak, tag, planPrices } = body;

    // Validate required fields
    if (!name || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await createStrategy({
      name,
      description,
      performance: 0,
      parameters: {},
      riskLevel: 'Medium',
      category: 'Value',
      imageUrl: imageUrl || '/default-strategy.svg',
      minCapital,
      avgDrawdown,
      riskReward,
      winStreak,
      tag,
      planPrices,
      details: details || '',
      enabled: enabled !== undefined ? enabled : true,
      contentType,
      contentUrl
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create strategy' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true as const, 
      strategy: result.strategy 
    });
  } catch (error) {
    console.error('Error creating strategy:', error);
    return NextResponse.json(
      { error: 'Failed to create strategy' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/strategies
 * Update an existing strategy (admin only)
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id, name, description, imageUrl, details, enabled, contentType, contentUrl, minCapital, avgDrawdown, riskReward, winStreak, tag, planPrices } = body;

    // Validate required fields
    if (!id || !name || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await updateStrategy(id, {
      name,
      description,
      imageUrl: imageUrl || undefined,
      details: details || '',
      enabled: enabled !== undefined ? enabled : true,
      contentType,
      contentUrl,
      minCapital,
      avgDrawdown,
      riskReward,
      winStreak,
      tag,
      planPrices
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update strategy' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true as const, 
      strategy: result.strategy 
    });
  } catch (error) {
    console.error('Error updating strategy:', error);
    return NextResponse.json(
      { error: 'Failed to update strategy' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/strategies
 * Delete a strategy (admin only)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Strategy ID is required' },
        { status: 400 }
      );
    }

    const result = await deleteStrategy(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete strategy' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true as const, 
      message: 'Strategy deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting strategy:', error);
    return NextResponse.json(
      { error: 'Failed to delete strategy' },
      { status: 500 }
    );
  }
}