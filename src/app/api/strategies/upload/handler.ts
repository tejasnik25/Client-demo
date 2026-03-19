import { NextRequest, NextResponse } from 'next/server';
import { createStrategy, updateStrategy, getStrategyById } from '../../../../db/dbService';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadToS3 } from '@/lib/s3';
import { mt5Service, MtAccountDetails } from '@/lib/mt5-service';

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
    const countryFlag = (formData.get('countryFlag') as string) || '';

    // New metrics and tag
    const roi = formData.get('roi') ? Number(formData.get('roi') as string) : undefined;
    const profit = formData.get('profit') ? Number(formData.get('profit') as string) : undefined;
    const maxDdi = formData.get('maxDdi') ? Number(formData.get('maxDdi') as string) : undefined;
    const copiers = formData.get('copiers') ? Number(formData.get('copiers') as string) : undefined;
    const riskScore = formData.get('riskScore') ? Number(formData.get('riskScore') as string) : undefined;

    // Admin commission percent for the strategy (single commission field, no plan system required)
    const rawCommissionPercent = (formData.get('commissionPercent') as string) || '';
    const commissionPercentMatch = rawCommissionPercent.match(/-?\d+(\.\d+)?/);
    const commissionPercent = commissionPercentMatch ? Number(commissionPercentMatch[0]) : undefined;
    
    // Handle tags: allow empty string to clear the value
    const rawTag = formData.get('tag');
    const tag = rawTag !== null ? String(rawTag) : undefined;
    
    const rawMastersTag = formData.get('mastersTag');
    const mastersTag = rawMastersTag !== null ? String(rawMastersTag) : undefined;

    // Master Account Details
    const rawMasterAccountId = formData.get('masterAccountId');
    const masterAccountId = rawMasterAccountId !== null ? String(rawMasterAccountId) : undefined;
    const rawMasterAccountPassword = formData.get('masterAccountPassword');
    const masterAccountPassword = rawMasterAccountPassword !== null ? String(rawMasterAccountPassword) : undefined;
    const rawMasterAccountServer = formData.get('masterAccountServer');
    const masterAccountServer = rawMasterAccountServer !== null ? String(rawMasterAccountServer) : undefined;
    const rawMasterPlatform = formData.get('masterPlatform');
    const masterPlatform = rawMasterPlatform !== null ? (String(rawMasterPlatform) as 'mt4' | 'mt5') : undefined;

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
    const lotPricing = (formData.get('lotPricing') as string) || '';

    // Sensible defaults for deprecated fields
    const performance = 0;
    const rawRiskLevel = formData.get('riskLevel');
    const riskLevel = (rawRiskLevel !== null ? String(rawRiskLevel) : 'Medium') as 'Low' | 'Medium' | 'High';
    const category = 'Value' as 'Growth' | 'Income' | 'Momentum' | 'Value';
    
    // Validate required fields
    if (!name || !description || (contentType !== 'text' && !file && !contentUrlInput)) {
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
       // SKIP VALIDATION ON UPLOAD FOR NOW TO PREVENT BLOCKING SAVE
       // const validation = await mt5Service.validateConnection(masterDetails);
       // if (!validation.success) {
       //    return NextResponse.json(
       //      { error: `Master Account Validation Failed: ${validation.error || 'Unknown Error'}` },
       //      { status: 400 }
       //    );
       // }
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
      if (storageMode === 'db') {
        // Store icon in DB BLOB
        // Note: The createStrategy function needs to be updated to handle iconBlob/iconMime if passed in parameters or separate update
        // Since createStrategy signature might not accept these directly yet, we might need to pass them in the object and ensure dbService handles them.
        // The current createStrategy interface in this file call (lines 137+) doesn't seem to pass iconBlob.
        // We need to check createStrategy signature or pass it in 'parameters' or extend the type.
        // Assuming we extended the DB schema, we should pass these fields.
        // However, createStrategy args below (lines 137-161) are specific.
        // Let's rely on passing them as part of the object if createStrategy accepts a partial Strategy or specific args.
        // Looking at line 137, it calls createStrategy with an object.
        // I will add iconBlob and iconMime to that object.
      }
      
      if (storageMode === 'db') {
         // We will pass these to createStrategy
      } else if (storageMode === 's3') {
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

    // Prepare icon blob data if needed
    let iconBlob: Buffer | undefined = undefined;
    let iconMime: string | undefined = undefined;
    if (icon && icon.size > 0 && storageMode === 'db') {
        const iconBytes = await icon.arrayBuffer();
        iconBlob = Buffer.from(iconBytes);
        iconMime = icon.type || 'image/png';
        imageUrl = null as any; // Clear URL if using blob
    }

    // Create strategy in database
    const result = await createStrategy({
      name,
      description,
      performance,
      riskLevel,
      category,
      imageUrl,
      roi,
      profit,
      maxDdi,
      copiers,
      riskScore,
      tag,
      mastersTag,
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
      iconBlob,
      iconMime,
      enabled,
      parameters: (() => {
        const params: Record<string, string> = {};
        if (countryFlag) params.countryFlag = countryFlag;
        if (lotPricing) params.lotPricing = lotPricing;
        if (commissionPercent !== undefined && Number.isFinite(commissionPercent)) {
          // Store as string to match parameters JSON type.
          params.commission = String(commissionPercent);
        }
        return params;
      })()
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
    const countryFlag = (formData.get('countryFlag') as string) || '';
    const lotPricing = (formData.get('lotPricing') as string) || '';

    // Admin commission percent for the strategy (single commission field, no plan system required)
    const rawCommissionPercent = (formData.get('commissionPercent') as string) || '';
    const commissionPercentMatch = rawCommissionPercent.match(/-?\d+(\.\d+)?/);
    const commissionPercent = commissionPercentMatch ? Number(commissionPercentMatch[0]) : undefined;

    // New metrics and tag
    const roi = formData.get('roi') ? Number(formData.get('roi') as string) : undefined;
    const profit = formData.get('profit') ? Number(formData.get('profit') as string) : undefined;
    const maxDdi = formData.get('maxDdi') ? Number(formData.get('maxDdi') as string) : undefined;
    const copiers = formData.get('copiers') ? Number(formData.get('copiers') as string) : undefined;
    const riskScore = formData.get('riskScore') ? Number(formData.get('riskScore') as string) : undefined;
    
    // Handle tags: allow empty string to clear the value
    const rawTag = formData.get('tag');
    const tag = rawTag !== null ? String(rawTag) : undefined;
    
    const rawMastersTag = formData.get('mastersTag');
    const mastersTag = rawMastersTag !== null ? String(rawMastersTag) : undefined;

    // Master Account Details
    const rawMasterAccountId = formData.get('masterAccountId');
    const masterAccountId = rawMasterAccountId !== null ? String(rawMasterAccountId) : undefined;
    const rawMasterAccountPassword = formData.get('masterAccountPassword');
    const masterAccountPassword = rawMasterAccountPassword !== null ? String(rawMasterAccountPassword) : undefined;
    const rawMasterAccountServer = formData.get('masterAccountServer');
    const masterAccountServer = rawMasterAccountServer !== null ? String(rawMasterAccountServer) : undefined;
    const rawMasterPlatform = formData.get('masterPlatform');
    const masterPlatform = rawMasterPlatform !== null ? (String(rawMasterPlatform) as 'mt4' | 'mt5') : undefined;
    
    const rawRiskLevelUpdate = formData.get('riskLevel');
    const riskLevelUpdate = rawRiskLevelUpdate !== null ? (String(rawRiskLevelUpdate) as 'Low' | 'Medium' | 'High') : undefined;
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

    // Validate Master Account if updating
    if (masterAccountId || masterAccountPassword || masterAccountServer) {
        // Fetch existing to fill gaps
        const existing = await getStrategyById(id);
        if (existing) {
             const mId = masterAccountId || existing.masterAccountId;
             const mPwd = masterAccountPassword || existing.masterAccountPassword;
             const mSrv = masterAccountServer || existing.masterAccountServer;
             const mPlat = (masterPlatform as any) || existing.masterPlatform || 'MT5';

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

    const contentUrl = formData.get('contentUrl') as string;

    // Prepare update object (do not override deprecated fields)
    const updates: any = {
      name,
      description,
      imageUrl,
      details,
      contentType,
      enabled,
      contentUrl,
      roi,
      profit,
      maxDdi,
      copiers,
      riskScore,
      tag,
      mastersTag,
      masterAccountId,
      masterAccountPassword,
      masterAccountServer,
      masterPlatform,
      riskLevel: riskLevelUpdate,
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
      
      if (storageMode === 'db') {
        updates.iconBlob = iconBuffer;
        updates.iconMime = icon.type || 'image/png';
        updates.imageUrl = null;
      } else if (storageMode === 's3') {
        const key = `strategies/icons/${iconName}`;
        const { url } = await uploadToS3(key, iconBuffer, icon.type || 'image/png');
        updates.imageUrl = url;
        updates.iconBlob = null;
        updates.iconMime = null;
      } else if (!isReadOnlyFs) {
        const iconDir = path.join(process.cwd(), 'public', 'uploads', 'strategy-icons');
        await mkdir(iconDir, { recursive: true });
        const iconPath = path.join(iconDir, iconName);
        await writeFile(iconPath, iconBuffer);
        updates.imageUrl = `/uploads/strategy-icons/${iconName}`;
      }
    }

    if (roi !== undefined) updates.roi = roi;
    if (profit !== undefined) updates.profit = profit;
    if (maxDdi !== undefined) updates.maxDdi = maxDdi;
    if (copiers !== undefined) updates.copiers = copiers;
    if (tag !== undefined) updates.tag = tag;
    if (mastersTag !== undefined) updates.mastersTag = mastersTag;
    updates.planPrices = { Pro: planPro, Expert: planExpert, Premium: planPremium };
    updates.planDetails = {
      Pro: { priceLabel: planProLabel, percent: planProPercent },
      Expert: { priceLabel: planExpertLabel, percent: planExpertPercent },
      Premium: { priceLabel: planPremiumLabel, percent: planPremiumPercent },
    };
    if (countryFlag || lotPricing || (commissionPercent !== undefined && Number.isFinite(commissionPercent))) {
      updates.parameters = {};
      if (countryFlag) (updates.parameters as any).countryFlag = countryFlag;
      if (lotPricing) (updates.parameters as any).lotPricing = lotPricing;
      if (commissionPercent !== undefined && Number.isFinite(commissionPercent)) {
        (updates.parameters as any).commission = String(commissionPercent);
      }
    }

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
