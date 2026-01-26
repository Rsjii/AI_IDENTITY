import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import * as voiceService from './voiceService';

/**
 * POST /api/voice/upload
 * Upload audio sample and create voice clone
 */
export async function uploadVoiceSample(req: Request, res: Response) {
  try {
    const userId = req.userId!; // From jwtAuth middleware
    const file = req.file;
    const { label } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    logger.info(`[Voice Upload] User ${userId} uploading voice sample: ${file.originalname}`);

    const result = await voiceService.uploadAndCreateVoice(userId, file, label);

    return res.status(201).json({
      success: true,
      message: 'Voice clone created successfully',
      voiceClone: result,
    });
  } catch (error: any) {
    logger.error('[Voice Upload] Error:', error);
    return res.status(500).json({
      error: 'Failed to upload voice sample',
      message: error.message,
    });
  }
}

/**
 * POST /api/voice/train/:voiceId
 * Train voice model (used if training is async)
 */
export async function trainVoice(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { voiceId } = req.params;

    logger.info(`[Voice Train] User ${userId} training voice ${voiceId}`);

    const result = await voiceService.trainVoiceModel(userId, voiceId);

    return res.status(200).json({
      success: true,
      message: 'Voice training started',
      voiceClone: result,
    });
  } catch (error: any) {
    logger.error('[Voice Train] Error:', error);
    return res.status(500).json({
      error: 'Failed to train voice',
      message: error.message,
    });
  }
}

/**
 * GET /api/voice/list
 * List all voice clones for user
 */
export async function listVoiceClones(req: Request, res: Response) {
  try {
    const userId = req.userId!;

    const voices = await voiceService.listUserVoices(userId);

    return res.status(200).json({
      success: true,
      voices,
    });
  } catch (error: any) {
    logger.error('[Voice List] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch voice clones',
      message: error.message,
    });
  }
}

/**
 * GET /api/voice/:voiceId
 * Get specific voice clone
 */
export async function getVoiceClone(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { voiceId } = req.params;

    const voice = await voiceService.getVoiceById(userId, voiceId);

    if (!voice) {
      return res.status(404).json({ error: 'Voice clone not found' });
    }

    return res.status(200).json({
      success: true,
      voice,
    });
  } catch (error: any) {
    logger.error('[Voice Get] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch voice clone',
      message: error.message,
    });
  }
}

/**
 * DELETE /api/voice/:voiceId
 * Delete voice clone
 */
export async function deleteVoiceClone(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { voiceId } = req.params;

    await voiceService.deleteVoice(userId, voiceId);

    return res.status(200).json({
      success: true,
      message: 'Voice clone deleted successfully',
    });
  } catch (error: any) {
    logger.error('[Voice Delete] Error:', error);
    return res.status(500).json({
      error: 'Failed to delete voice clone',
      message: error.message,
    });
  }
}

/**
 * POST /api/voice/generate
 * Generate voice from text (TTS)
 * Body: { text: string, voiceId: string }
 */
export async function generateVoice(req: Request, res: Response) {
  try {
    const userId = req.userId!;
    const { text, voiceId } = req.body;

    if (!text || !voiceId) {
      return res.status(400).json({ error: 'Missing required fields: text, voiceId' });
    }

    logger.info(`[Voice Generate] User ${userId} generating voice for ${text.length} chars`);

    const audioUrl = await voiceService.generateVoiceAudio(userId, voiceId, text);

    return res.status(200).json({
      success: true,
      audioUrl,
    });
  } catch (error: any) {
    logger.error('[Voice Generate] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate voice',
      message: error.message,
    });
  }
}
