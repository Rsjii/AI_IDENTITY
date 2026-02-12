/**
 * File Management Controller
 * Handles file listing, deletion, and storage quota management
 */

import { Request, Response } from 'express';
import { pool } from '../../config/db';
import fs from 'fs/promises';
import path from 'path';

/**
 * GET /api/creator/files
 * List all files uploaded by the creator
 */
export async function listFiles(req: Request, res: Response) {
  const userId = (req as any).user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get voice clones
    const voiceClones = await pool.query(
      `SELECT
         id,
         COALESCE("label", 'Untitled') as name,
         "sampleAudioUrl" as file_url,
         COALESCE(file_size_bytes, 0) as file_size_bytes,
         "createdAt" as created_at,
         'voice' as type
       FROM "voice_clones"
       WHERE "userId" = $1
       ORDER BY "createdAt" DESC`,
      [userId]
    );

    // Get video avatars
    const videoAvatars = await pool.query(
      `SELECT
         id,
         COALESCE("label", 'Untitled') as name,
         "sampleVideoUrl" as file_url,
         COALESCE(file_size_bytes, 0) as file_size_bytes,
         "createdAt" as created_at,
         'video' as type
       FROM "video_avatars"
       WHERE "userId" = $1
       ORDER BY "createdAt" DESC`,
      [userId]
    );

    // Combine and format files
    const allFiles = [
      ...voiceClones.rows.map(file => ({
        id: file.id,
        name: file.name || 'Untitled',
        type: file.type,
        fileUrl: file.file_url,
        sizeMB: (file.file_size_bytes / (1024 * 1024)).toFixed(2),
        sizeBytes: file.file_size_bytes,
        uploadedAt: new Date(file.created_at).toLocaleDateString(),
        createdAt: file.created_at
      })),
      ...videoAvatars.rows.map(file => ({
        id: file.id,
        name: file.name || 'Untitled',
        type: file.type,
        fileUrl: file.file_url,
        sizeMB: (file.file_size_bytes / (1024 * 1024)).toFixed(2),
        sizeBytes: file.file_size_bytes,
        uploadedAt: new Date(file.created_at).toLocaleDateString(),
        createdAt: file.created_at
      }))
    ];

    // Sort by created_at descending
    allFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({
      success: true,
      files: allFiles,
      total: allFiles.length
    });

  } catch (error) {
    console.error('List files error:', error);
    return res.status(500).json({ error: 'Failed to list files' });
  }
}

/**
 * GET /api/creator/storage
 * Get storage usage statistics
 */
export async function getStorageUsage(req: Request, res: Response) {
  const userId = (req as any).user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `SELECT
        plan_tier,
        plan_storage_mb,
        storage_used_mb
       FROM "User"
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { plan_tier, plan_storage_mb, storage_used_mb } = result.rows[0];
    const quotaMB = plan_storage_mb || 100; // Default 100 MB
    const usedMB = storage_used_mb || 0;
    const percentageUsed = Math.min(Math.round((usedMB / quotaMB) * 100), 100);

    return res.json({
      success: true,
      planTier: plan_tier,
      quotaMB,
      usedMB: parseFloat(usedMB.toFixed(2)),
      remainingMB: parseFloat((quotaMB - usedMB).toFixed(2)),
      percentageUsed
    });

  } catch (error) {
    console.error('Get storage usage error:', error);
    return res.status(500).json({ error: 'Failed to get storage usage' });
  }
}

/**
 * DELETE /api/creator/files/:id
 * Delete a file and update storage quota
 */
export async function deleteFile(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const { id } = req.params;
  const { type } = req.query; // 'voice' or 'video'

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!type || (type !== 'voice' && type !== 'video')) {
    return res.status(400).json({
      error: 'Invalid file type. Must be "voice" or "video"'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let fileData;
    let filePath;

    if (type === 'voice') {
      // Get voice clone data
      const result = await client.query(
        `SELECT "sampleAudioUrl" as file_url, COALESCE(file_size_bytes,0) as file_size_bytes, "userId" as user_id
         FROM "voice_clones"
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Voice file not found' });
      }

      fileData = result.rows[0];

      // Check ownership
      if (fileData.user_id !== userId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Unauthorized to delete this file' });
      }

      // Delete from database
      await client.query(
        `DELETE FROM "voice_clones" WHERE id = $1`,
        [id]
      );

      filePath = fileData.file_url;

    } else if (type === 'video') {
      // Get video avatar data
      const result = await client.query(
        `SELECT "sampleVideoUrl" as video_url, COALESCE(file_size_bytes,0) as file_size_bytes, "userId" as user_id
         FROM "video_avatars"
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Video file not found' });
      }

      fileData = result.rows[0];

      // Check ownership
      if (fileData.user_id !== userId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Unauthorized to delete this file' });
      }

      // Delete from database
      await client.query(
        `DELETE FROM "video_avatars" WHERE id = $1`,
        [id]
      );

      filePath = fileData.video_url;
    }

    // Decrease storage usage
    const fileSizeBytes = fileData.file_size_bytes || 0;
    const fileSizeMB = fileSizeBytes / (1024 * 1024);

    await client.query(
      `UPDATE "User"
       SET storage_used_mb = GREATEST(storage_used_mb - $1, 0)
       WHERE id = $2`,
      [fileSizeMB, userId]
    );

    await client.query('COMMIT');

    // Try to delete physical file (non-blocking, best effort)
    if (filePath) {
      try {
        // Extract file path from URL if needed
        let actualPath = filePath;

        // If it's a URL path like /uploads/..., convert to absolute path
        if (filePath.startsWith('/uploads/') || filePath.startsWith('uploads/')) {
          const relativePath = filePath.replace(/^\//, '');
          actualPath = path.join(process.cwd(), relativePath);
        }

        await fs.unlink(actualPath);
        console.log(`✅ Physical file deleted: ${actualPath}`);
      } catch (fileError) {
        // Log but don't fail the request if file doesn't exist
        console.warn(`⚠️ Could not delete physical file: ${filePath}`, fileError);
      }
    }

    return res.json({
      success: true,
      message: 'File deleted successfully',
      storageFreed: parseFloat(fileSizeMB.toFixed(2))
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete file error:', error);
    return res.status(500).json({ error: 'Failed to delete file' });
  } finally {
    client.release();
  }
}

/**
 * Helper: Update file size for existing uploads
 * This is called by upload controllers to track file size
 */
export async function updateFileSize(
  fileId: string,
  fileType: 'voice' | 'video',
  fileSizeBytes: number
): Promise<void> {
  const tableName = fileType === 'voice' ? 'voice_clones' : 'video_avatars';

  await pool.query(
    `UPDATE ${tableName}
     SET file_size_bytes = $1
     WHERE id = $2`,
    [fileSizeBytes, fileId]
  );
}
