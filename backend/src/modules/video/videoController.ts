import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../config/database';
import { generateId } from '../../utils/idGenerator';
import { createVideoAvatarExternal, generateVideoFromText, uploadSampleVideo } from './videoService';

function getUserId(req: Request): string | null {
  return req.user?.id || req.user?.userId || null;
}

const generateSchema = z.object({
  avatarId: z.string().min(1),
  text: z.string().min(1),
});

export async function uploadVideoAvatar(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'No video uploaded' });

  try {
    const upload = await uploadSampleVideo(file.buffer, file.mimetype, file.originalname);
    let avatarId = '';
    let status = 'pending';

    try {
      const external = await createVideoAvatarExternal(upload.url);
      avatarId = external.avatarId || '';
      status = avatarId ? 'ready' : 'training';
    } catch {
      status = 'training';
    }

    const id = generateId.videoAvatar();
    const r = await db.query(
      `INSERT INTO "video_avatars"
       ("id","userId","provider","avatarId","label","sampleVideoUrl","status","createdAt","updatedAt")
       VALUES ($1,$2,'did',$3,$4,$5,$6,now(),now())
       RETURNING *`,
      [id, userId, avatarId || null, file.originalname, upload.url, status]
    );

    return res.json({ item: r.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Video upload failed' });
  }
}

export async function listVideoAvatars(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const r = await db.query(
    `SELECT * FROM "video_avatars" WHERE "userId"=$1 ORDER BY "createdAt" DESC`,
    [userId]
  );
  return res.json({ items: r.rows });
}

export async function deleteVideoAvatar(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const id = String(req.params.id || '').trim();
  await db.query(`DELETE FROM "video_avatars" WHERE id=$1 AND "userId"=$2`, [id, userId]);
  return res.json({ success: true });
}

export async function generateVideo(req: Request, res: Response) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const data = generateSchema.parse(req.body);
  const r = await db.query(
    `SELECT * FROM "video_avatars" WHERE id=$1 AND "userId"=$2 LIMIT 1`,
    [data.avatarId, userId]
  );
  const avatar = r.rows[0];
  if (!avatar) return res.status(404).json({ error: 'Avatar not found' });

  const result = await generateVideoFromText(avatar.avatarId, data.text);
  return res.json({ videoUrl: result.videoUrl });
}

