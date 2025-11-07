import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION as string;
const bucket = process.env.AWS_S3_BUCKET as string;

export const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array | Blob | string,
  contentType: string,
  acl: 'private' | 'public-read' = 'public-read'
) {
  if (!bucket || !region) {
    throw new Error('Missing AWS_S3_BUCKET or AWS_REGION');
  }
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body as any,
    ContentType: contentType,
    ACL: acl,
  });
  await s3Client.send(command);
  const url = process.env.AWS_S3_PUBLIC_URL_PREFIX
    ? `${process.env.AWS_S3_PUBLIC_URL_PREFIX}/${key}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  return { key, url };
}