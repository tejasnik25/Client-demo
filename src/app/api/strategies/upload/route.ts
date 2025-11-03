import { NextRequest, NextResponse } from 'next/server';
import { createStrategy, updateStrategy } from '../../../../db/dbService';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/strategies/upload
 * Create a new strategy with file upload (admin only)
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

    const formData = await req.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    // Optional legacy string imageUrl (used when no icon upload provided)
    let imageUrl = (formData.get('imageUrl') as string) || '/default-strategy.svg';
    const details = (formData.get('details') as string) || '';
    const contentType = (formData.get('contentType') as string) || 'html';
    const enabled = formData.get('enabled') === 'true';
    const file = formData.get('file') as File;
    const icon = formData.get('icon') as File | null;

    // New metrics and tag
    const minCapital = formData.get('minCapital') ? Number(formData.get('minCapital') as string) : undefined;
    const avgDrawdown = formData.get('avgDrawdown') ? Number(formData.get('avgDrawdown') as string) : undefined;
    const riskReward = formData.get('riskReward') ? Number(formData.get('riskReward') as string) : undefined;
    const winStreak = formData.get('winStreak') ? Number(formData.get('winStreak') as string) : undefined;
    const tag = (formData.get('tag') as string) || undefined;

    // Plan prices
    const planPro = formData.get('planPro') ? Number(formData.get('planPro') as string) : undefined;
    const planExpert = formData.get('planExpert') ? Number(formData.get('planExpert') as string) : undefined;
    const planPremium = formData.get('planPremium') ? Number(formData.get('planPremium') as string) : undefined;

    // Sensible defaults for deprecated fields
    const performance = 0;
    const riskLevel = 'Medium' as 'Low' | 'Medium' | 'High';
    const category = 'Value' as 'Growth' | 'Income' | 'Momentum' | 'Value';
    
    // Validate required fields
    if (!name || !description || !file) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Process file upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Create unique filename
    const fileExt = contentType === 'html' ? '.html' : '.pdf';
    const fileName = `strategy-${uuidv4()}${fileExt}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, fileName);
    
    // Save file
    await writeFile(filePath, buffer);
    
    // File URL for public access
    const contentUrl = `/uploads/${fileName}`;

    // Optional: icon upload for display image
    if (icon && icon.size > 0) {
      const iconBytes = await icon.arrayBuffer();
      const iconBuffer = Buffer.from(iconBytes);
      const iconExt = (icon.type && icon.type.includes('png')) ? '.png' : (icon.type && icon.type.includes('jpg')) ? '.jpg' : (icon.type && icon.type.includes('jpeg')) ? '.jpeg' : (icon.type && icon.type.includes('svg')) ? '.svg' : '.png';
      const iconName = `icon-${uuidv4()}${iconExt}`;
      const iconDir = path.join(process.cwd(), 'public', 'uploads', 'strategy-icons');
      await mkdir(iconDir, { recursive: true });
      const iconPath = path.join(iconDir, iconName);
      await writeFile(iconPath, iconBuffer);
      imageUrl = `/uploads/strategy-icons/${iconName}`;
    }

    // Create strategy in database
    const result = await createStrategy({
      name,
      description,
      performance,
      riskLevel,
      category,
      imageUrl,
      minCapital,
      avgDrawdown,
      riskReward,
      winStreak,
      tag,
      planPrices: { Pro: planPro, Expert: planExpert, Premium: planPremium },
      details,
      contentType,
      contentUrl,
      enabled,
      parameters: {}
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
 * PUT /api/strategies/upload
 * Update an existing strategy with file upload (admin only)
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing strategy ID' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    // Optional legacy string imageUrl
    let imageUrl = (formData.get('imageUrl') as string) || undefined as any;
    const details = (formData.get('details') as string) || '';
    const contentType = (formData.get('contentType') as string) || 'html';
    const enabled = formData.get('enabled') === 'true';
    const file = formData.get('file') as File;
    const icon = formData.get('icon') as File | null;

    // New metrics and tag
    const minCapital = formData.get('minCapital') ? Number(formData.get('minCapital') as string) : undefined;
    const avgDrawdown = formData.get('avgDrawdown') ? Number(formData.get('avgDrawdown') as string) : undefined;
    const riskReward = formData.get('riskReward') ? Number(formData.get('riskReward') as string) : undefined;
    const winStreak = formData.get('winStreak') ? Number(formData.get('winStreak') as string) : undefined;
    const tag = (formData.get('tag') as string) || undefined;
    // Plan prices
    const planPro = formData.get('planPro') ? Number(formData.get('planPro') as string) : undefined;
    const planExpert = formData.get('planExpert') ? Number(formData.get('planExpert') as string) : undefined;
    const planPremium = formData.get('planPremium') ? Number(formData.get('planPremium') as string) : undefined;
    
    // Validate required fields
    if (!name || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Prepare update object (do not override deprecated fields)
    const updates: any = {
      name,
      description,
      imageUrl,
      details,
      contentType,
      enabled
    };

    // Process file upload if provided
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Create unique filename
      const fileExt = contentType === 'html' ? '.html' : '.pdf';
      const fileName = `strategy-${uuidv4()}${fileExt}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      await mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, fileName);
      
      // Save file
      await writeFile(filePath, buffer);
      
      // File URL for public access
      updates.contentUrl = `/uploads/${fileName}`;
    }

    // Process icon upload if provided
    if (icon && icon.size > 0) {
      const iconBytes = await icon.arrayBuffer();
      const iconBuffer = Buffer.from(iconBytes);
      const iconExt = (icon.type && icon.type.includes('png')) ? '.png' : (icon.type && icon.type.includes('jpg')) ? '.jpg' : (icon.type && icon.type.includes('jpeg')) ? '.jpeg' : (icon.type && icon.type.includes('svg')) ? '.svg' : '.png';
      const iconName = `icon-${uuidv4()}${iconExt}`;
      const iconDir = path.join(process.cwd(), 'public', 'uploads', 'strategy-icons');
      await mkdir(iconDir, { recursive: true });
      const iconPath = path.join(iconDir, iconName);
      await writeFile(iconPath, iconBuffer);
      updates.imageUrl = `/uploads/strategy-icons/${iconName}`;
    }

    // Include metrics/tag/prices if provided
    if (minCapital !== undefined) updates.minCapital = minCapital;
    if (avgDrawdown !== undefined) updates.avgDrawdown = avgDrawdown;
    if (riskReward !== undefined) updates.riskReward = riskReward;
    if (winStreak !== undefined) updates.winStreak = winStreak;
    if (tag !== undefined) updates.tag = tag;
    updates.planPrices = { Pro: planPro, Expert: planExpert, Premium: planPremium };

    // Update strategy in database
    const result = await updateStrategy(id, updates);

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