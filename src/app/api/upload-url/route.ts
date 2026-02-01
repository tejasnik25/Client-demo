'use server';

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth-options';
import { v4 as uuidv4 } from 'uuid';

// Build S3 client only if env vars are present
const hasS3Config = Boolean(
  process.env.AWS_REGION &&
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  (process.env.NEXT_PUBLIC_AWS_S3_BUCKET || process.env.AWS_S3_BUCKET)
);

const s3Client = hasS3Config
  ? new S3Client({
      region: process.env.AWS_REGION as string,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
      },
    })
  : null as any;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { fileType, transactionId } = await req.json();
    const key = `${session.user.id}/${transactionId}/${uuidv4()}`;

    // If S3 is not configured, return a safe fallback so client can proceed
    if (!hasS3Config) {
      return NextResponse.json({
        signedUrl: null,
        key: null,
        useLocalFallback: true,
        message: 'S3 not configured; skipping upload.'
      });
    }

    const publicRead = process.env.S3_PUBLIC_READ === 'true';

    const command = new PutObjectCommand({
      Bucket: (process.env.NEXT_PUBLIC_AWS_S3_BUCKET || process.env.AWS_S3_BUCKET) as string,
      Key: key,
      ContentType: fileType,
      ...(publicRead ? { ACL: 'public-read' as const } : {}),
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    return NextResponse.json({ signedUrl, key });
  } catch (error) {
    console.error('Error creating signed URL:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}