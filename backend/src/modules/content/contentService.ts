import { uploadPublicBuffer } from '../../services/s3Service';
import { knowledgeSourceQueries, knowledgeChunkQueries } from '../../config/database';

function chunkText(text: string, chunkSize = 1200): string[] {
  const clean = (text || '').trim();
  if (!clean) return [];
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += chunkSize) out.push(clean.slice(i, i + chunkSize));
  return out;
}

export async function createPasteSource(userId: string, title: string | undefined, rawText: string) {
  const source = await knowledgeSourceQueries.create({ userId, type: 'paste', title, rawText });
  const chunks = chunkText(rawText);
  await knowledgeChunkQueries.replaceForSource(userId, source.id, chunks);
  return source;
}

export async function createYoutubeSource(userId: string, url: string, title?: string) {
  // MVP: no transcription yet, store URL only
  const source = await knowledgeSourceQueries.create({ userId, type: 'youtube', title: title || 'YouTube', originalUrl: url });
  await knowledgeChunkQueries.replaceForSource(userId, source.id, []);
  return source;
}

export async function createFileSource(userId: string, file: Express.Multer.File, title?: string) {
  // Store file bytes to S3/R2 as public URL (same infra as voice)
  const upload = await uploadPublicBuffer({
    keyPrefix: `knowledge/${userId}/files`,
    contentType: file.mimetype || 'application/octet-stream',
    body: file.buffer,
    ext: (file.originalname.split('.').pop() || '').toLowerCase(),
  });

  // MVP: no parsing, store filename + url; rawText empty
  const source = await knowledgeSourceQueries.create({
    userId,
    type: 'file',
    title: title || file.originalname,
    storageUrl: upload.url,
  });

  await knowledgeChunkQueries.replaceForSource(userId, source.id, []);
  return source;
}