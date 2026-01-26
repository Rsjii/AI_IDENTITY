import { Router } from 'express';
import multer from 'multer';
import { jwtAuth } from '../../middleware/jwtAuth';
import * as voiceController from './voiceController';

const router = Router();

// Multer configuration for audio uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/x-m4a', 'audio/mp4'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP3, WAV, and M4A are allowed.'));
    }
  },
});

// All routes require authentication
router.use(jwtAuth);

// POST /api/voice/upload - Upload audio sample and create voice clone
router.post('/upload', upload.single('audio'), voiceController.uploadVoiceSample);

// POST /api/voice/train - Train voice model (if async)
router.post('/train/:voiceId', voiceController.trainVoice);

// GET /api/voice/list - List all voice clones for user
router.get('/list', voiceController.listVoiceClones);

// GET /api/voice/:voiceId - Get specific voice clone
router.get('/:voiceId', voiceController.getVoiceClone);

// DELETE /api/voice/:voiceId - Delete voice clone
router.delete('/:voiceId', voiceController.deleteVoiceClone);

// POST /api/voice/generate - Generate voice from text (TTS)
router.post('/generate', voiceController.generateVoice);

export default router;
