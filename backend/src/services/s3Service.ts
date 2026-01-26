import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

function mustGet(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getClient() {
  const region = process.env.S3_REGION || 'ap-south-1';
  const endpoint = process.env.S3_ENDPOINT || undefined;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

  return new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? { accessKeyId: mustGet('AWS_ACCESS_KEY_ID'), secretAccessKey: mustGet('AWS_SECRET_ACCESS_KEY') }
      : undefined,
  });
}

function publicUrlForKey(key: string): string {
  const base = process.env.S3_PUBLIC_BASE_URL;
  const bucket = mustGet('S3_BUCKET');
  const region = process.env.S3_REGION || 'ap-south-1';

  if (base) return `${base.replace(/\/$/, '')}/${key}`;

  // AWS default style (works only if bucket/public policy allows)
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function uploadPublicBuffer(params: {
  keyPrefix: string;
  contentType: string;
  body: Buffer;
  ext?: string;
}): Promise<{ key: string; url: string }> {
  const bucket = mustGet('S3_BUCKET');
  const client = getClient();

  const rand = crypto.randomBytes(8).toString('hex');
  const ext = (params.ext || '').replace(/^\./, '');
  const key = `${params.keyPrefix.replace(/\/$/, '')}/${Date.now()}-${rand}${ext ? `.${ext}` : ''}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.body,
      ContentType: params.contentType,
      // NOTE: ACL is not supported on some S3-compatible providers; rely on bucket/public domain.
      // ACL: 'public-read',
    })
  );

  return { key, url: publicUrlForKey(key) };
}

