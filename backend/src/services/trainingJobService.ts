import { trainingJobQueries, userQueries } from '../config/database';
import { logger } from '../config/logger';
import { ragService } from './ragService';
import { EmailService } from '../modules/auth/authService';

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

        // Notify user (best effort)
        try {
          const user = await userQueries.findById(job.userId);
          if (user?.email) {
            const emailService = new EmailService();
            await emailService.sendTrainingReady(user.email);
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






