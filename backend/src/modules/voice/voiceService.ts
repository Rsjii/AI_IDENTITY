import { logger } from '../../config/logger';
import { voiceCloneQueries } from '../../config/database';

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

  const data = await response.json();
  return data.voice_id; // ElevenLabs returns the voice_id
}

/**
 * Generate speech using ElevenLabs TTS
 */
async function generateElevenLabsSpeech(voiceId: string, text: string): Promise<ArrayBuffer> {
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
        stability: 0.5,
        similarity_boost: 0.75,
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
  try {
    // Create voice clone record in DB (status: pending)
    const voiceClone = await voiceCloneQueries.create(userId, label || file.originalname, 'elevenlabs');

    logger.info(`[Voice Service] Created voice clone record: ${voiceClone.id}`);

    // Update status to training
    await voiceCloneQueries.updateStatus(voiceClone.id, 'training');

    // Upload to ElevenLabs and get voice_id
    const elevenlabsVoiceId = await createElevenLabsVoice(
      file.buffer,
      file.originalname,
      label || `Voice ${Date.now()}`
    );

    logger.info(`[Voice Service] ElevenLabs voice created: ${elevenlabsVoiceId}`);

    // TODO: Upload audio to S3/Cloudinary for storage
    // For now, we'll just store the ElevenLabs voice_id
    const sampleAudioUrl = null; // Replace with S3 URL when implemented

    // Update voice clone with ElevenLabs voice_id and mark as ready
    await voiceCloneQueries.updateVoiceId(voiceClone.id, elevenlabsVoiceId, sampleAudioUrl);
    await voiceCloneQueries.updateStatus(voiceClone.id, 'ready');

    const updatedVoice = await voiceCloneQueries.findById(voiceClone.id);

    return updatedVoice;
  } catch (error: any) {
    logger.error('[Voice Service] Error in uploadAndCreateVoice:', error);
    throw error;
  }
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
 * Generate voice audio from text
 */
export async function generateVoiceAudio(userId: string, voiceId: string, text: string): Promise<string> {
  const voice = await voiceCloneQueries.findById(voiceId);

  if (!voice || voice.userId !== userId) {
    throw new Error('Voice clone not found');
  }

  if (voice.status !== 'ready') {
    throw new Error('Voice clone is not ready yet');
  }

  if (!voice.voiceId) {
    throw new Error('Voice clone has no provider voice ID');
  }

  // Generate speech using ElevenLabs
  const audioBuffer = await generateElevenLabsSpeech(voice.voiceId, text);

  // TODO: Upload to S3/Cloudinary and return URL
  // For now, return base64 data URL
  const base64Audio = Buffer.from(audioBuffer).toString('base64');
  const dataUrl = `data:audio/mpeg;base64,${base64Audio}`;

  logger.info(`[Voice Service] Generated ${audioBuffer.byteLength} bytes of audio`);

  return dataUrl;
}
