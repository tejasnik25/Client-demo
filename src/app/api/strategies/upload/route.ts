import { NextRequest, NextResponse } from 'next/server';
import { createStrategy, updateStrategy } from '../../../../db/dbService';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { writeFile } from 'fs/promises';
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
    const imageUrl = (formData.get('imageUrl') as string) || '/default-strategy.svg';
    const details = (formData.get('details') as string) || '';
    const contentType = (formData.get('contentType') as string) || 'html';
    const enabled = formData.get('enabled') === 'true';
    const file = formData.get('file') as File;

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
    const filePath = path.join(process.cwd(), 'public', 'uploads', fileName);
    
    // Save file
    await writeFile(filePath, buffer);
    
    // File URL for public access
    const contentUrl = `/uploads/${fileName}`;

    // Create strategy in database
    const result = await createStrategy({
      name,
      description,
      performance,
      riskLevel,
      category,
      imageUrl,
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
    const imageUrl = (formData.get('imageUrl') as string) || '/default-strategy.svg';
    const details = (formData.get('details') as string) || '';
    const contentType = (formData.get('contentType') as string) || 'html';
    const enabled = formData.get('enabled') === 'true';
    const file = formData.get('file') as File;
    
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
      const filePath = path.join(process.cwd(), 'public', 'uploads', fileName);
      
      // Save file
      await writeFile(filePath, buffer);
      
      // File URL for public access
      updates.contentUrl = `/uploads/${fileName}`;
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