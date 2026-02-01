import { NextRequest, NextResponse } from 'next/server';
import { getAllStrategies, createStrategy, updateStrategy, deleteStrategy, getStrategyById } from '../../../db/dbService';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { mt5Service, MtAccountDetails } from '@/lib/mt5-service';

export const dynamic = 'force-dynamic';

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
    const { 
      name, description, imageUrl, details, enabled, contentType, contentUrl, 
      roi, profit, maxDdi, copiers, riskScore, tag, planPrices,
      masterAccountId, masterAccountPassword, masterAccountServer, masterPlatform
    } = body;

    // Validate required fields
    if (!name || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate Master Account if provided
    if (masterAccountId && masterAccountPassword && masterAccountServer) {
       const masterDetails: MtAccountDetails = {
          id: masterAccountId,
          password: masterAccountPassword,
          server: masterAccountServer,
          platform: (masterPlatform ? masterPlatform.toUpperCase() as 'MT4'|'MT5' : 'MT5')
       };
       const validation = await mt5Service.validateConnection(masterDetails);
       if (!validation.success) {
          return NextResponse.json(
            { error: `Master Account Validation Failed: ${validation.error || 'Unknown Error'}` },
            { status: 400 }
          );
       }
    }

    const result = await createStrategy({
      name,
      description,
      performance: 0,
      parameters: {},
      riskLevel: 'Medium',
      category: 'Value',
      imageUrl: imageUrl || '/default-strategy.svg',
      roi,
      profit,
      maxDdi,
      copiers,
      riskScore,
      tag,
      planPrices,
      details: details || '',
      enabled: enabled !== undefined ? enabled : true,
      contentType,
      contentUrl,
      masterAccountId,
      masterAccountPassword,
      masterAccountServer,
      masterPlatform
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
    const { 
      id, name, description, imageUrl, details, enabled, contentType, contentUrl, 
      roi, profit, maxDdi, copiers, riskScore, tag, planPrices,
      masterAccountId, masterAccountPassword, masterAccountServer, masterPlatform
    } = body;

    // Validate required fields
    if (!id || !name || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate Master Account if updating
    if (masterAccountId || masterAccountPassword || masterAccountServer) {
        // Fetch existing to fill gaps
        const existing = await getStrategyById(id);
        if (existing) {
             const mId = masterAccountId || existing.masterAccountId;
             const mPwd = masterAccountPassword || existing.masterAccountPassword;
             const mSrv = masterAccountServer || existing.masterAccountServer;
             const mPlat = ((masterPlatform as any) || existing.masterPlatform || 'MT5').toUpperCase() as 'MT4' | 'MT5';

             if (mId && mPwd && mSrv) {
                 const masterDetails: MtAccountDetails = {
                    id: mId,
                    password: mPwd,
                    server: mSrv,
                    platform: mPlat
                 };
                 const validation = await mt5Service.validateConnection(masterDetails);
                 if (!validation.success) {
                     return NextResponse.json(
                        { error: `Master Account Validation Failed: ${validation.error}` },
                        { status: 400 }
                     );
                 }
             }
        }
    }

    const result = await updateStrategy(id, {
      name,
      description,
      imageUrl: imageUrl || undefined,
      details: details || '',
      enabled: enabled !== undefined ? enabled : true,
      contentType,
      contentUrl,
      roi,
      profit,
      maxDdi,
      copiers,
      riskScore,
      tag,
      planPrices,
      masterAccountId,
      masterAccountPassword,
      masterAccountServer,
      masterPlatform
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