import { trainingJobQueries, userQueries, db } from '../config/database';
import { logger } from '../config/logger';
import { ragService } from './ragService';
import { EmailService } from '../modules/auth/authService';
import { isProd } from '../config/env';

let isProcessing = false;

export async function ensureTrainingJob(userId: string) {
  const latest = await trainingJobQueries.findLatestByUserId(userId);
  if (latest && (latest.status === 'pending' || latest.status === 'processing')) {
    return latest;
  }
  return trainingJobQueries.create(userId);
}

export async function processTrainingJobs(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const jobs = await trainingJobQueries.listPending();
    for (const job of jobs) {
      try {
        await trainingJobQueries.markProcessing(job.id);
        await ragService.generateEmbeddingsForUser(job.userId);
        await trainingJobQueries.markCompleted(job.id);

        // ✅ FIX: Notify user (prod-only, idempotent)
        try {
          const user = await userQueries.findById(job.userId);
          if (isProd && user?.email) {
            // ✅ Idempotent: send only once
            const sentCheck = await db.query(
              `SELECT 1 FROM "Event" WHERE "userId"=$1 AND "type"='training_ready_email_sent' LIMIT 1`,
              [job.userId]
            );

            if (!sentCheck.rows[0]) {
              const emailService = new EmailService();
              await emailService.sendTrainingReady(user.email);

              await db.query(
                `INSERT INTO "Event" (id, "userId", "type", "meta") VALUES ($1, $2, $3, $4)`,
                [
                  `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                  job.userId,
                  'training_ready_email_sent',
                  JSON.stringify({ source: 'training_job' })
                ]
              );
            }
          }
        } catch (emailError: any) {
          logger.warn('[TrainingJobs] Email notification failed:', emailError?.message || emailError);
        }
      } catch (err: any) {
        await trainingJobQueries.markFailed(job.id, err?.message || 'Training job failed');
        logger.error('[TrainingJobs] Job failed:', err);
      }
    }
  } finally {
    isProcessing = false;
  }
}








