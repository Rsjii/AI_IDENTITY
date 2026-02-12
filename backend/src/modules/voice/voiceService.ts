import { logger } from '../../config/logger';
import { voiceCloneQueries } from '../../config/database';
import { uploadPublicBuffer } from '../../services/s3Service';

// ========== ELEVENLABS INTEGRATION ==========

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

/**
 * Upload audio to ElevenLabs and create voice clone
 */
async function createElevenLabsVoice(audioBuffer: Buffer, fileName: string, label: string): Promise<string> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured. Please add it to your environment variables.');
  }

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  formData.append('files', blob, fileName);
  formData.append('name', label || `Voice Clone ${Date.now()}`);

  const response = await fetch(`${ELEVENLABS_API_BASE}/voices/add`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('[ElevenLabs] Voice creation failed:', errorText);
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { voice_id: string };
  return data.voice_id; // ElevenLabs returns the voice_id
}

/**
 * Generate speech using ElevenLabs TTS
 */
async function generateElevenLabsSpeech(
  voiceId: string,
  text: string,
  settings?: { stability?: number; similarity_boost?: number }
): Promise<ArrayBuffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const response = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: settings?.stability ?? 0.5,
        similarity_boost: settings?.similarity_boost ?? 0.75,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('[ElevenLabs] TTS failed:', errorText);
    throw new Error(`ElevenLabs TTS error: ${response.status} - ${errorText}`);
  }

  return await response.arrayBuffer();
}

/**
 * Delete voice from ElevenLabs
 */
async function deleteElevenLabsVoice(elevenlabsVoiceId: string): Promise<void> {
  if (!ELEVENLABS_API_KEY) {
    return; // Skip if no API key
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/voices/${elevenlabsVoiceId}`, {
      method: 'DELETE',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    if (!response.ok) {
      logger.error(`[ElevenLabs] Failed to delete voice ${elevenlabsVoiceId}: ${response.status}`);
    }
  } catch (error) {
    logger.error('[ElevenLabs] Error deleting voice:', error);
  }
}

// ========== SERVICE FUNCTIONS ==========

/**
 * Upload audio file and create voice clone
 */
export async function uploadAndCreateVoice(userId: string, file: Express.Multer.File, label?: string) {
  const voiceClone = await voiceCloneQueries.create(userId, label || file.originalname, 'elevenlabs');
  await voiceCloneQueries.updateStatus(voiceClone.id, 'training');

  // 1) Upload sample to S3/R2 (public URL)
  const sampleUpload = await uploadPublicBuffer({
    keyPrefix: `voices/${userId}/${voiceClone.id}/samples`,
    contentType: file.mimetype || 'audio/mpeg',
    body: file.buffer,
    ext: (file.originalname.split('.').pop() || 'mp3').toLowerCase(),
  });

  // 2) Create ElevenLabs voice
  const elevenlabsVoiceId = await createElevenLabsVoice(file.buffer, file.originalname, label || `Voice ${Date.now()}`);

  // 3) Save voiceId + sampleAudioUrl
  await voiceCloneQueries.updateVoiceId(voiceClone.id, elevenlabsVoiceId, sampleUpload.url);
  await voiceCloneQueries.updateStatus(voiceClone.id, 'ready');

  // 4) Update storage usage
  try {
    const { updateStorageUsage } = await import('../../middleware/storageQuota');
    await updateStorageUsage(userId, file.size);
  } catch (error) {
    logger.warn({ error, userId, fileSize: file.size }, 'Failed to update storage usage for voice sample');
  }

  return await voiceCloneQueries.findById(voiceClone.id);
}

/**
 * Train voice model (for providers that require async training)
 */
export async function trainVoiceModel(userId: string, voiceId: string) {
  const voice = await voiceCloneQueries.findById(voiceId);

  if (!voice || voice.userId !== userId) {
    throw new Error('Voice clone not found');
  }

  if (voice.provider === 'elevenlabs') {
    // ElevenLabs training is instant, so just mark as ready
    await voiceCloneQueries.updateStatus(voiceId, 'ready');
  }

  return await voiceCloneQueries.findById(voiceId);
}

/**
 * List all voice clones for user
 */
export async function listUserVoices(userId: string) {
  return await voiceCloneQueries.findByUserId(userId);
}

/**
 * Get voice clone by ID
 */
export async function getVoiceById(userId: string, voiceId: string) {
  const voice = await voiceCloneQueries.findById(voiceId);

  if (!voice || voice.userId !== userId) {
    return null;
  }

  return voice;
}

/**
 * Delete voice clone
 */
export async function deleteVoice(userId: string, voiceId: string) {
  const voice = await voiceCloneQueries.findById(voiceId);

  if (!voice || voice.userId !== userId) {
    throw new Error('Voice clone not found');
  }

  // Delete from ElevenLabs if it exists
  if (voice.voiceId && voice.provider === 'elevenlabs') {
    await deleteElevenLabsVoice(voice.voiceId);
  }

  // Delete from database
  await voiceCloneQueries.delete(userId, voiceId);

  return true;
}

/**
 * Update voice settings (speed/pitch/emotion placeholders)
 */
export async function updateVoiceSettings(userId: string, voiceId: string, settings: any) {
  const voice = await voiceCloneQueries.findById(voiceId);
  if (!voice || voice.userId !== userId) {
    throw new Error('Voice clone not found');
  }
  return await voiceCloneQueries.updateSettings(voiceId, settings || {});
}

/**
 * Generate voice audio from text
 */
export async function generateVoiceAudio(userId: string, voiceCloneId: string, text: string): Promise<string> {
  const voice = await voiceCloneQueries.findById(voiceCloneId);
  if (!voice || voice.userId !== userId) throw new Error('Voice clone not found');
  if (voice.status !== 'ready') throw new Error('Voice clone is not ready yet');
  if (!voice.voiceId) throw new Error('Voice clone has no provider voice ID');

  const settings = (voice.settings || {}) as { stability?: number; similarity_boost?: number };
  const ab = await generateElevenLabsSpeech(voice.voiceId, text, settings);
  const buf = Buffer.from(ab);

  // Upload generated audio to S3/R2 and return a public URL
  const out = await uploadPublicBuffer({
    keyPrefix: `voices/${userId}/${voiceCloneId}/tts`,
    contentType: 'audio/mpeg',
    body: buf,
    ext: 'mp3',
  });

  logger.info(`[Voice Service] Generated ${buf.byteLength} bytes of audio → ${out.url}`);
  return out.url;
}
