import { Router } from 'express';
import multer from 'multer';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { validateCSRF } from '../../middleware/csrf';
import { checkStorageQuota } from '../../middleware/storageQuota';
import * as voiceController from './voiceController';

const router = Router();

// Multer configuration for audio uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/x-m4a', 'audio/mp4'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP3, WAV, and M4A are allowed.'));
    }
  },
});

// Cookie-auth (same as /api/identity)
router.use(requireJWTFromCookie);

// Upload sample (CSRF + Storage Quota)
router.post('/upload', upload.single('audio'), checkStorageQuota, validateCSRF, voiceController.uploadVoiceSample);

// Train (CSRF)
router.post('/train/:voiceId', validateCSRF, voiceController.trainVoice);

// List / get (no CSRF needed)
router.get('/list', voiceController.listVoiceClones);
router.get('/:voiceId', voiceController.getVoiceClone);

// Delete (CSRF)
router.delete('/:voiceId', validateCSRF, voiceController.deleteVoiceClone);

// Generate TTS (CSRF)
router.post('/generate', validateCSRF, voiceController.generateVoice);

// Update settings (CSRF)
router.patch('/:voiceId/settings', validateCSRF, voiceController.updateVoiceSettings);

export default router;
