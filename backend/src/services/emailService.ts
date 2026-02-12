/**
 * Email Notification Service
 * Sends transactional emails for token system events
 */

import nodemailer from 'nodemailer';
import { logger } from '../config/logger';
import db from '../config/db';

// =====================================================
// EMAIL CONFIGURATION
// =====================================================

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@aiavatar.com';
const FROM_NAME = process.env.FROM_NAME || 'AI Avatar Platform';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// =====================================================
// TRANSPORTER SETUP
// =====================================================

let transporter: nodemailer.Transporter | null = null;

if (EMAIL_ENABLED) {
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    // Verify connection
    transporter.verify((error) => {
      if (error) {
        logger.error('Email transporter verification failed:', error);
      } else {
        logger.info('Email service ready');
      }
    });
  } catch (error) {
    logger.error('Failed to create email transporter:', error);
  }
}

// =====================================================
// EMAIL TEMPLATES
// =====================================================

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function tokenWarning80Template(userName: string, tierName: string): EmailTemplate {
  return {
    subject: '⚠️ Token Usage Warning - 80% Limit Reached',
    html: `
      <h2>Token Usage Warning</h2>
      <p>Hi ${userName},</p>
      <p>You've used <strong>80%</strong> of your monthly token quota on your <strong>${tierName}</strong> plan.</p>
      <p>What happens next:</p>
      <ul>
        <li>✅ You still have 20% of your quota remaining</li>
        <li>⚠️ Your avatars will stop responding when you reach 100%</li>
        <li>💡 Consider upgrading to avoid interruption</li>
      </ul>
      <p><a href="${FRONTEND_URL}/dashboard/billing" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Upgrade Plan</a></p>
      <p>Thanks,<br>The AI Avatar Team</p>
    `,
    text: `
Token Usage Warning - 80% Limit Reached

Hi ${userName},

You've used 80% of your monthly token quota on your ${tierName} plan.

What happens next:
- You still have 20% of your quota remaining
- Your avatars will stop responding when you reach 100%
- Consider upgrading to avoid interruption

Upgrade your plan: ${FRONTEND_URL}/dashboard/billing

Thanks,
The AI Avatar Team
    `,
  };
}

function tokenWarning90Template(userName: string, tierName: string): EmailTemplate {
  return {
    subject: '🚨 Token Usage Critical - 90% Limit Reached',
    html: `
      <h2>Token Usage Critical</h2>
      <p>Hi ${userName},</p>
      <p>You've used <strong>90%</strong> of your monthly token quota on your <strong>${tierName}</strong> plan.</p>
      <p><strong>Action Required:</strong></p>
      <ul>
        <li>⚠️ Only 10% of your quota remains</li>
        <li>🛑 Your avatars will stop responding at 100%</li>
        <li>🔄 Quota resets on ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</li>
        <li>💡 Upgrade now to avoid downtime</li>
      </ul>
      <p><a href="${FRONTEND_URL}/dashboard/billing" style="background: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Upgrade Now</a></p>
      <p>Thanks,<br>The AI Avatar Team</p>
    `,
    text: `
Token Usage Critical - 90% Limit Reached

Hi ${userName},

You've used 90% of your monthly token quota on your ${tierName} plan.

Action Required:
- Only 10% of your quota remains
- Your avatars will stop responding at 100%
- Quota resets on ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
- Upgrade now to avoid downtime

Upgrade your plan: ${FRONTEND_URL}/dashboard/billing

Thanks,
The AI Avatar Team
    `,
  };
}

function tokenQuotaExceededTemplate(userName: string, tierName: string): EmailTemplate {
  return {
    subject: '🛑 Token Quota Exceeded - Avatars Paused',
    html: `
      <h2>Token Quota Exceeded</h2>
      <p>Hi ${userName},</p>
      <p>You've reached <strong>100%</strong> of your monthly token quota on your <strong>${tierName}</strong> plan.</p>
      <p><strong>What this means:</strong></p>
      <ul>
        <li>🛑 Your avatars have stopped responding to messages</li>
        <li>⏰ Quota will reset automatically next month</li>
        <li>⚡ Upgrade now to resume immediately</li>
      </ul>
      <p><a href="${FRONTEND_URL}/dashboard/billing" style="background: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Upgrade to Resume</a></p>
      <p>Thanks,<br>The AI Avatar Team</p>
    `,
    text: `
Token Quota Exceeded - Avatars Paused

Hi ${userName},

You've reached 100% of your monthly token quota on your ${tierName} plan.

What this means:
- Your avatars have stopped responding to messages
- Quota will reset automatically next month
- Upgrade now to resume immediately

Upgrade your plan: ${FRONTEND_URL}/dashboard/billing

Thanks,
The AI Avatar Team
    `,
  };
}

function storageWarning80Template(userName: string, storageUsedMB: number, storageLimitMB: number): EmailTemplate {
  return {
    subject: '⚠️ Storage Warning - 80% Full',
    html: `
      <h2>Storage Warning</h2>
      <p>Hi ${userName},</p>
      <p>Your storage is <strong>80% full</strong> (${storageUsedMB.toFixed(1)} MB / ${storageLimitMB} MB).</p>
      <p>What happens next:</p>
      <ul>
        <li>✅ You can still upload files for now</li>
        <li>⚠️ Uploads will be blocked at 100%</li>
        <li>💡 Consider upgrading for more storage</li>
      </ul>
      <p><a href="${FRONTEND_URL}/dashboard/billing" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Upgrade Plan</a></p>
      <p>Thanks,<br>The AI Avatar Team</p>
    `,
    text: `
Storage Warning - 80% Full

Hi ${userName},

Your storage is 80% full (${storageUsedMB.toFixed(1)} MB / ${storageLimitMB} MB).

What happens next:
- You can still upload files for now
- Uploads will be blocked at 100%
- Consider upgrading for more storage

Upgrade your plan: ${FRONTEND_URL}/dashboard/billing

Thanks,
The AI Avatar Team
    `,
  };
}

function storageQuotaFullTemplate(userName: string, storageLimitMB: number): EmailTemplate {
  return {
    subject: '🛑 Storage Full - Uploads Blocked',
    html: `
      <h2>Storage Full</h2>
      <p>Hi ${userName},</p>
      <p>Your storage is <strong>100% full</strong> (${storageLimitMB} MB limit reached).</p>
      <p><strong>What this means:</strong></p>
      <ul>
        <li>🛑 You can't upload new files, videos, or voice samples</li>
        <li>✅ Existing content still works</li>
        <li>⚡ Upgrade now to get more storage</li>
      </ul>
      <p><a href="${FRONTEND_URL}/dashboard/billing" style="background: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Upgrade for More Storage</a></p>
      <p>Thanks,<br>The AI Avatar Team</p>
    `,
    text: `
Storage Full - Uploads Blocked

Hi ${userName},

Your storage is 100% full (${storageLimitMB} MB limit reached).

What this means:
- You can't upload new files, videos, or voice samples
- Existing content still works
- Upgrade now to get more storage

Upgrade your plan: ${FRONTEND_URL}/dashboard/billing

Thanks,
The AI Avatar Team
    `,
  };
}

// =====================================================
// SEND EMAIL FUNCTIONS
// =====================================================

async function sendEmail(to: string, template: EmailTemplate): Promise<void> {
  if (!EMAIL_ENABLED) {
    logger.info('Email disabled, would have sent:', { to, subject: template.subject });
    return;
  }

  if (!transporter) {
    logger.error('Email transporter not initialized');
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    logger.info('Email sent successfully', {
      to,
      subject: template.subject,
      messageId: info.messageId,
    });
  } catch (error) {
    logger.error('Failed to send email:', { error, to, subject: template.subject });
    throw error;
  }
}

/**
 * Get user email by ID
 */
async function getUserEmail(userId: string): Promise<{ email: string; name: string } | null> {
  try {
    const result = await db.query(
      `SELECT email, name FROM "User" WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      email: result.rows[0].email,
      name: result.rows[0].name || 'User',
    };
  } catch (error) {
    logger.error('Error fetching user email:', error);
    return null;
  }
}

// =====================================================
// PUBLIC API
// =====================================================

/**
 * Send token usage warning (80% or 90%)
 */
export async function sendTokenWarning(
  userId: string,
  percentage: number,
  planTier: string
): Promise<void> {
  const user = await getUserEmail(userId);
  if (!user) {
    logger.warn('User not found for token warning email:', userId);
    return;
  }

  let template: EmailTemplate;
  if (percentage >= 90) {
    template = tokenWarning90Template(user.name, planTier);
  } else {
    template = tokenWarning80Template(user.name, planTier);
  }

  await sendEmail(user.email, template);
}

/**
 * Send token quota exceeded notification
 */
export async function sendTokenQuotaExceeded(
  userId: string,
  planTier: string
): Promise<void> {
  const user = await getUserEmail(userId);
  if (!user) {
    logger.warn('User not found for quota exceeded email:', userId);
    return;
  }

  const template = tokenQuotaExceededTemplate(user.name, planTier);
  await sendEmail(user.email, template);
}

/**
 * Send storage warning (80%)
 */
export async function sendStorageWarning(
  userId: string,
  storageUsedMB: number,
  storageLimitMB: number
): Promise<void> {
  const user = await getUserEmail(userId);
  if (!user) {
    logger.warn('User not found for storage warning email:', userId);
    return;
  }

  const template = storageWarning80Template(user.name, storageUsedMB, storageLimitMB);
  await sendEmail(user.email, template);
}

/**
 * Send storage full notification
 */
export async function sendStorageFull(
  userId: string,
  storageLimitMB: number
): Promise<void> {
  const user = await getUserEmail(userId);
  if (!user) {
    logger.warn('User not found for storage full email:', userId);
    return;
  }

  const template = storageQuotaFullTemplate(user.name, storageLimitMB);
  await sendEmail(user.email, template);
}

export default {
  sendTokenWarning,
  sendTokenQuotaExceeded,
  sendStorageWarning,
  sendStorageFull,
};
