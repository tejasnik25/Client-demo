import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION as string;
const bucket = process.env.AWS_S3_BUCKET as string;

export const s3Client = new S3Client({ region });

async function detectBucketRegion(client: S3Client): Promise<string | null> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return region || null;
  } catch (err: unknown) {
    const e = err as { $metadata?: { httpHeaders?: Record<string, string> }; Endpoint?: string };
    const headers = e?.$metadata?.httpHeaders || {};
    const hinted = headers['x-amz-bucket-region'] || headers['X-Amz-Bucket-Region'];
    if (typeof hinted === 'string' && hinted.length > 0) {
      return hinted;
    }
    // Try parsing endpoint from error if available
    const endpoint = e?.Endpoint as string | undefined;
    if (endpoint && endpoint.includes('.s3.')) {
      const parts = endpoint.split('.s3.')[1]?.split('.amazonaws');
      const epRegion = parts && parts[0] ? parts[0] : null;
      return epRegion;
    }
    return null;
  }
}

export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array | Blob | string,
  contentType: string
) {
  if (!bucket || !region) {
    throw new Error('Missing AWS_S3_BUCKET or AWS_REGION');
  }
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  try {
    await s3Client.send(command);
  } catch (err: unknown) {
    const e = err as { Code?: string; name?: string };
    // Handle region mismatch redirects by detecting bucket region and retrying once
    const isPermanentRedirect = e?.Code === 'PermanentRedirect' || e?.name === 'PermanentRedirect';
    if (isPermanentRedirect) {
      const hintedRegion = await detectBucketRegion(s3Client);
      if (hintedRegion && hintedRegion !== region) {
        const retryClient = new S3Client({ region: hintedRegion });
        await retryClient.send(command);
        const url = process.env.AWS_S3_PUBLIC_URL_PREFIX
          ? `${process.env.AWS_S3_PUBLIC_URL_PREFIX}/${key}`
          : `https://${bucket}.s3.${hintedRegion}.amazonaws.com/${key}`;
        return { key, url };
      }
    }
    throw err;
  }
  const url = process.env.AWS_S3_PUBLIC_URL_PREFIX
    ? `${process.env.AWS_S3_PUBLIC_URL_PREFIX}/${key}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  return { key, url };
}
