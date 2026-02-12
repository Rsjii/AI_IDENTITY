-- Migration: Add file size tracking to all file storage tables
-- This enables proper storage quota management on file deletion

-- 1. Add file_size_bytes to voice_clones table
ALTER TABLE voice_clones
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT DEFAULT 0;

-- 2. Add file_size_bytes to video_avatars table
ALTER TABLE video_avatars
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT DEFAULT 0;

-- 3. Create index for storage queries
CREATE INDEX IF NOT EXISTS idx_voice_clones_user_id ON voice_clones(user_id);
CREATE INDEX IF NOT EXISTS idx_video_avatars_user_id ON video_avatars(user_id);

-- 4. Update existing records to have 0 file size (will be updated on next upload)
UPDATE voice_clones SET file_size_bytes = 0 WHERE file_size_bytes IS NULL;
UPDATE video_avatars SET file_size_bytes = 0 WHERE file_size_bytes IS NULL;

-- Note: For existing files, storage_used_mb in User table is already tracked
-- New uploads will track precise file sizes going forward
