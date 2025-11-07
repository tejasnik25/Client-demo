import { NextRequest, NextResponse } from 'next/server';
import { createStrategy, updateStrategy } from '../../../../db/dbService';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadToS3 } from '@/lib/s3';

/**
 * POST /api/strategies/upload
 * Create a new strategy with file upload (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const isReadOnlyFs = !!process.env.VERCEL; // Vercel serverless is read-only
    const storageMode = process.env.STORAGE_MODE || 'db'; // 'db' (default, Vercel-safe)
    
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
    const contentUrlInput = (formData.get('contentUrl') as string) || undefined;
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
    // Plan display labels and percents
    const planProLabel = (formData.get('planProLabel') as string) || undefined;
    const planExpertLabel = (formData.get('planExpertLabel') as string) || undefined;
    const planPremiumLabel = (formData.get('planPremiumLabel') as string) || undefined;
    const planProPercent = formData.get('planProPercent') ? Number(formData.get('planProPercent') as string) : undefined;
    const planExpertPercent = formData.get('planExpertPercent') ? Number(formData.get('planExpertPercent') as string) : undefined;
    const planPremiumPercent = formData.get('planPremiumPercent') ? Number(formData.get('planPremiumPercent') as string) : undefined;

    // Sensible defaults for deprecated fields
    const performance = 0;
    const riskLevel = 'Medium' as 'Low' | 'Medium' | 'High';
    const category = 'Value' as 'Growth' | 'Income' | 'Momentum' | 'Value';
    
    // Validate required fields
    if (!name || !description || (contentType !== 'text' && !file && !contentUrlInput)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Determine content storage (avoid filesystem writes on Vercel)
    let contentUrl: string | undefined = undefined;
    let contentBlob: Buffer | undefined = undefined;
    let contentMime: string | undefined = undefined;
    if (contentType === 'text') {
      // No file expected for text-only content; rely on details field
      contentUrl = '';
    } else if (contentUrlInput) {
      // Accept external or data URL directly; no file required
      contentUrl = contentUrlInput;
    } else if (file && file.size > 0) {
      if (storageMode === 'db') {
        const bytes = await file.arrayBuffer();
        contentBlob = Buffer.from(bytes);
        contentMime = file.type || (contentType === 'html' ? 'text/html' : 'application/pdf');
        contentUrl = null as any;
      } else if (storageMode === 's3') {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileExt = contentType === 'html' ? '.html' : '.pdf';
        const fileName = `strategy-${uuidv4()}${fileExt}`;
        const key = `strategies/content/${fileName}`;
        const { url } = await uploadToS3(key, buffer, file.type || (contentType === 'html' ? 'text/html' : 'application/pdf'));
        contentUrl = url;
        contentBlob = undefined;
        contentMime = file.type || (contentType === 'html' ? 'text/html' : 'application/pdf');
      } else if (!isReadOnlyFs) {
        // Optional: local disk path for non-Vercel dev (not used on Vercel)
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileExt = contentType === 'html' ? '.html' : '.pdf';
        const fileName = `strategy-${uuidv4()}${fileExt}`;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, fileName);
        await writeFile(filePath, buffer);
        contentUrl = `/uploads/${fileName}`;
      } else {
        // On Vercel and non-db storageMode, fail gracefully
        return NextResponse.json(
          { error: 'File storage mode not supported on Vercel without DB or S3' },
          { status: 400 }
        );
      }
    }

    // Optional: icon upload for display image
    if (icon && icon.size > 0) {
      const iconBytes = await icon.arrayBuffer();
      const iconBuffer = Buffer.from(iconBytes);
      const iconExt = (icon.type && icon.type.includes('png')) ? '.png' : (icon.type && icon.type.includes('jpg')) ? '.jpg' : (icon.type && icon.type.includes('jpeg')) ? '.jpeg' : (icon.type && icon.type.includes('svg')) ? '.svg' : '.png';
      const iconName = `icon-${uuidv4()}${iconExt}`;
      if (storageMode === 's3') {
        const key = `strategies/icons/${iconName}`;
        const { url } = await uploadToS3(key, iconBuffer, icon.type || 'image/png');
        imageUrl = url;
      } else if (!isReadOnlyFs) {
        const iconDir = path.join(process.cwd(), 'public', 'uploads', 'strategy-icons');
        await mkdir(iconDir, { recursive: true });
        const iconPath = path.join(iconDir, iconName);
        await writeFile(iconPath, iconBuffer);
        imageUrl = `/uploads/strategy-icons/${iconName}`;
      }
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
      planDetails: {
        Pro: { priceLabel: planProLabel, percent: planProPercent },
        Expert: { priceLabel: planExpertLabel, percent: planExpertPercent },
        Premium: { priceLabel: planPremiumLabel, percent: planPremiumPercent },
      },
      details,
      contentType,
      contentUrl,
      contentBlob,
      contentMime,
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
    const isReadOnlyFs = !!process.env.VERCEL;
    const storageMode = process.env.STORAGE_MODE || 'db';
    
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
    // Plan display labels and percents
    const planProLabel = (formData.get('planProLabel') as string) || undefined;
    const planExpertLabel = (formData.get('planExpertLabel') as string) || undefined;
    const planPremiumLabel = (formData.get('planPremiumLabel') as string) || undefined;
    const planProPercent = formData.get('planProPercent') ? Number(formData.get('planProPercent') as string) : undefined;
    const planExpertPercent = formData.get('planExpertPercent') ? Number(formData.get('planExpertPercent') as string) : undefined;
    const planPremiumPercent = formData.get('planPremiumPercent') ? Number(formData.get('planPremiumPercent') as string) : undefined;
    
    // Validate required fields
    if (!name || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const contentUrl = formData.get('contentUrl') as string;

    // Prepare update object (do not override deprecated fields)
    const updates: any = {
      name,
      description,
      imageUrl,
      details,
      contentType,
      enabled,
      contentUrl
    };

    // Process file upload if provided (DB BLOB on Vercel)
    if (file && file.size > 0) {
      if (storageMode === 'db') {
        const bytes = await file.arrayBuffer();
        updates.contentBlob = Buffer.from(bytes);
        updates.contentMime = file.type || (contentType === 'html' ? 'text/html' : 'application/pdf');
        updates.contentUrl = null;
      } else if (storageMode === 's3') {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileExt = contentType === 'html' ? '.html' : '.pdf';
        const fileName = `strategy-${uuidv4()}${fileExt}`;
        const key = `strategies/content/${fileName}`;
        const { url } = await uploadToS3(key, buffer, file.type || (contentType === 'html' ? 'text/html' : 'application/pdf'));
        updates.contentUrl = url;
        updates.contentBlob = null;
        updates.contentMime = file.type || (contentType === 'html' ? 'text/html' : 'application/pdf');
      } else if (!isReadOnlyFs) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileExt = contentType === 'html' ? '.html' : '.pdf';
        const fileName = `strategy-${uuidv4()}${fileExt}`;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, fileName);
        await writeFile(filePath, buffer);
        updates.contentUrl = `/uploads/${fileName}`;
      } else {
        return NextResponse.json(
          { error: 'File storage mode not supported on Vercel without DB or S3' },
          { status: 400 }
        );
      }
    }

    // Process icon upload if provided (skip on Vercel)
    if (icon && icon.size > 0) {
      const iconBytes = await icon.arrayBuffer();
      const iconBuffer = Buffer.from(iconBytes);
      const iconExt = (icon.type && icon.type.includes('png')) ? '.png' : (icon.type && icon.type.includes('jpg')) ? '.jpg' : (icon.type && icon.type.includes('jpeg')) ? '.jpeg' : (icon.type && icon.type.includes('svg')) ? '.svg' : '.png';
      const iconName = `icon-${uuidv4()}${iconExt}`;
      if (storageMode === 's3') {
        const key = `strategies/icons/${iconName}`;
        const { url } = await uploadToS3(key, iconBuffer, icon.type || 'image/png');
        updates.imageUrl = url;
      } else if (!isReadOnlyFs) {
        const iconDir = path.join(process.cwd(), 'public', 'uploads', 'strategy-icons');
        await mkdir(iconDir, { recursive: true });
        const iconPath = path.join(iconDir, iconName);
        await writeFile(iconPath, iconBuffer);
        updates.imageUrl = `/uploads/strategy-icons/${iconName}`;
      }
    }

    // Include metrics/tag/prices if provided
    if (minCapital !== undefined) updates.minCapital = minCapital;
    if (avgDrawdown !== undefined) updates.avgDrawdown = avgDrawdown;
    if (riskReward !== undefined) updates.riskReward = riskReward;
    if (winStreak !== undefined) updates.winStreak = winStreak;
    if (tag !== undefined) updates.tag = tag;
    updates.planPrices = { Pro: planPro, Expert: planExpert, Premium: planPremium };
    updates.planDetails = {
      Pro: { priceLabel: planProLabel, percent: planProPercent },
      Expert: { priceLabel: planExpertLabel, percent: planExpertPercent },
      Premium: { priceLabel: planPremiumLabel, percent: planPremiumPercent },
    };

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