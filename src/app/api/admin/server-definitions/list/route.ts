import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      return NextResponse.json({ files: [] });
    }

    const files = fs.readdirSync(uploadsDir)
      .filter(file => file.endsWith('.srv') || file.endsWith('.dat'))
      .map(file => {
        const stats = fs.statSync(path.join(uploadsDir, file));
        return {
          name: file,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          path: `/uploads/${file}`
        };
      });

    return NextResponse.json({ files });
  } catch (error: any) {
    console.error('Error listing server definitions:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
