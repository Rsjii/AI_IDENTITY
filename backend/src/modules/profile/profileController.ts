import { Request, Response } from 'express';
import { userQueries } from '../../config/database';
import { logger } from '../../config/logger';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { db } from '../../config/database';
import JSZip from 'jszip';
import { EmailService, generateOTP, hashOTP, verifyOTP } from '../auth/authService';
import { otpQueries } from '../../config/database';

function getUserId(req: Request): string | null {
  const u: any = (req as any).user;
  return u?.id || u?.userId || null;
}

export const updateProfile = async (req: Request, res: Response) => {
  try {
    // Check if user is logged in via JWT
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // ✅ FIX: Handle file upload if present
    let profileImagePath = undefined;
    
    // ✅ FIX: Use ENV-driven uploads root (prod persistent volume support)
    const uploadsRoot = process.env.UPLOADS_DIR
      ? path.resolve(process.env.UPLOADS_DIR)
      : path.resolve(process.cwd(), 'public/uploads');
    
    if (req.file) {
      // File was uploaded
      const uploadDir = path.join(uploadsRoot, 'profiles');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Get current user to delete old image
      const currentUser = await userQueries.findByEmail(req.user.email);
      if (currentUser && currentUser.profileImage && currentUser.profileImage.startsWith('/uploads/')) {
        const rel = currentUser.profileImage.replace(/^\/uploads\//, ''); // e.g. profiles/x.png
        const oldImagePath = path.join(uploadsRoot, rel);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      // Save new file with unique name
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileExt = path.extname(req.file.originalname);
      const newFileName = `profile-${uniqueSuffix}${fileExt}`;
      const filePath = path.join(uploadDir, newFileName);
      
      // Write file to disk
      fs.writeFileSync(filePath, req.file.buffer);
      
      // Set profile image path
      profileImagePath = `/uploads/profiles/${newFileName}`;
    }

    // ✅ FIX: Parse form data (can be from multipart/form-data or JSON)
    const updateProfileSchema = z.object({
      name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    
      // ✅ tighten: no spaces, only a-z0-9_ and hyphen
      handle: z.string()
        .min(3, 'Handle must be at least 3 characters')
        .max(20, 'Handle must be at most 20 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Handle can only contain letters, numbers, hyphens, and underscores')
        .optional(),
    
      dob: z.string().optional()
        .refine((value) => {
          if (!value) return true;
          const d = new Date(value);
          if (Number.isNaN(d.getTime())) return false;
          const today = new Date();
          if (d > today) return false;                     // future date
          const ageMs = today.getTime() - d.getTime();
          const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
          return ageYears >= 13;                          // min age 13
        }, 'Please enter a valid date of birth (must be at least 13 years old and not in the future)'),
    
        phone: z.string()
        .optional()
        .refine((value) => {
          // ✅ Optional field - allow empty
          if (!value || value.trim() === '') return true;
          
          // ✅ MUST start with +
          if (!value.trim().startsWith('+')) {
            return false;
          }
          
          // ✅ Split by space: +[country code] [phone number]
          const parts = value.trim().split(/\s+/);
          
          // ✅ Must have exactly 2 parts: [+countryCode] and [phoneNumber]
          if (parts.length !== 2) {
            return false;
          }
          
          const countryCodePart = parts[0]; // e.g. "+91"
          const phoneNumberPart = parts[1];  // e.g. "1234567890"
          
          // ✅ Country code part: must be + followed by 1-3 digits (not starting with 0)
          if (!/^\+[1-9]\d{0,2}$/.test(countryCodePart)) {
            return false; // +1, +91, +123 valid; +0, +01, +0123 invalid
          }
          
          // ✅ Phone number part: must be exactly 10 digits
          if (!/^\d{10}$/.test(phoneNumberPart)) {
            return false;
          }
          
          return true;
        }, 'Phone number must be in format: +[country code] [10 digits] (e.g. +91 1234567890 or +1 1234567890)'),
                      
      bio: z.string().max(300, 'Bio too long').optional(),
      profileImage: z.string().nullable().optional(),
      timeZone: z.string().max(64).optional(),
      socialLinks: z.object({
        twitter: z.string().url().nullable().optional(),
        instagram: z.string().url().nullable().optional(),
        youtube: z.string().url().nullable().optional(),
        website: z.string().url().nullable().optional(),
      }).optional(),
      notificationPreferences: z.object({
        emailNotifications: z.boolean().optional(),
        paymentNotifications: z.boolean().optional(),
        weeklySummary: z.boolean().optional(),
      }).optional(),
      priceConfig: z.unknown().optional(),
    });    

    // ✅ FIX: Parse from req.body (multer will parse multipart/form-data)
    const { name, phone, profileImage, timeZone, socialLinks, notificationPreferences, priceConfig } = updateProfileSchema.parse(req.body);

    // Get current user data
    const currentUser = await userQueries.findByEmail(req.user.email);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare values for update (only name, phone, timezone, profileImage)
    const finalName = name !== undefined ? name : currentUser.name || '';
    const finalPhone = phone !== undefined ? phone : currentUser.phone || '';
    // ✅ FIX: Use uploaded file path if file was uploaded, otherwise use provided profileImage or current
    const finalProfileImage = profileImagePath !== undefined 
      ? profileImagePath 
      : (profileImage !== undefined ? profileImage : currentUser.profileImage || '');

    // Update user profile using raw SQL (handle/bio/dob not used)
    const updatedUser = await userQueries.updateProfile(
      req.user.email,
      finalName,
      '', // handle - not used
      null, // dob - not used
      finalPhone,
      '', // bio - not used
      finalProfileImage,
      timeZone
    );

    // ✅ Save social links if provided
    if (socialLinks !== undefined) {
      await db.query(
        `UPDATE "User" SET "socialLinks" = $1 WHERE email = $2`,
        [JSON.stringify(socialLinks), req.user.email]
      );
      logger.info(`Social links updated for user: ${req.user.email}`);
    }

    // ✅ Save notification preferences if provided
    if (notificationPreferences !== undefined) {
      await db.query(
        `UPDATE "User" SET "notificationPreferences" = $1 WHERE email = $2`,
        [JSON.stringify(notificationPreferences), req.user.email]
      );
      logger.info(`Notification preferences updated for user: ${req.user.email}`);
    }

    // ✅ Save price config if provided
    if (priceConfig !== undefined) {
      if (typeof priceConfig !== 'object' || priceConfig === null || Array.isArray(priceConfig)) {
        return res.status(400).json({ error: 'Invalid priceConfig' });
      }
      await userQueries.updatePricing(currentUser.id, priceConfig);
    }

    return res.json({
      success: true,
      user: {
        name: updatedUser.name,
        phone: updatedUser.phone,
        profileImage: updatedUser.profileImage,
      },
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const exportProfileData = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await db.query(`SELECT * FROM "User" WHERE id=$1 LIMIT 1`, [userId]);
    const identities = await db.query(`SELECT * FROM "identities" WHERE "userId"=$1`, [userId]);
    const identityVersions = await db.query(
      `SELECT iv.* FROM "identity_versions" iv JOIN "identities" i ON i.id = iv."identityId" WHERE i."userId"=$1`,
      [userId]
    );
    const chatSessions = await db.query(`SELECT * FROM "chat_sessions" WHERE "creatorId"=$1`, [userId]);
    const chatMessages = await db.query(
      `SELECT cm.* FROM "chat_messages" cm JOIN "chat_sessions" cs ON cs.id = cm."sessionId" WHERE cs."creatorId"=$1`,
      [userId]
    );
    const payments = await db.query(`SELECT * FROM "stripe_payments" WHERE "creatorId"=$1`, [userId]);
    const knowledgeSources = await db.query(`SELECT * FROM "knowledge_sources" WHERE "userId"=$1`, [userId]);

    const uploads = {
      profileImage: user.rows[0]?.profileImage || null,
      knowledgeSources: knowledgeSources.rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        originalUrl: r.originalUrl,
        storageUrl: r.storageUrl,
      })),
    };

    const zip = new JSZip();
    zip.file('profile.json', JSON.stringify(user.rows[0] || {}, null, 2));
    zip.file('identities.json', JSON.stringify(identities.rows || [], null, 2));
    zip.file('identity_versions.json', JSON.stringify(identityVersions.rows || [], null, 2));
    zip.file('chat_sessions.json', JSON.stringify(chatSessions.rows || [], null, 2));
    zip.file('chat_messages.json', JSON.stringify(chatMessages.rows || [], null, 2));
    zip.file('payments.json', JSON.stringify(payments.rows || [], null, 2));
    zip.file('uploads.json', JSON.stringify(uploads, null, 2));

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="profile-export-${new Date().toISOString().split('T')[0]}.zip"`
    );
    return res.send(buffer);
  } catch (error: any) {
    logger.error('Export profile error:', error);
    return res.status(500).json({ error: 'Failed to export data' });
  }
};

export const requestAccountDeletionOtp = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const email = String(req.user.email || '').toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email not found' });

    const emailService = new EmailService();
    const otp = generateOTP(6);
    const hashed = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await otpQueries.deleteByEmail(email, 'delete');
    await otpQueries.create(email, hashed, expiresAt, 'delete');

    const sent = await emailService.sendOTP(email, otp, 'delete');
    if (!sent) {
      return res.status(500).json({ error: 'Failed to send OTP' });
    }

    return res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error: any) {
    logger.error('Request delete OTP error:', error);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
};

const deleteAccountSchema = z.object({
  otpCode: z.string().length(6).regex(/^\d{6}$/),
});

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { otpCode } = deleteAccountSchema.parse(req.body || {});
    const email = String(req.user.email || '').toLowerCase();

    const otpRecord = await otpQueries.findByEmail(email, 'delete');
    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const nowMs = Date.now();
    const expiresAtMs = otpRecord.expiresAt instanceof Date
      ? otpRecord.expiresAt.getTime()
      : new Date(String(otpRecord.expiresAt)).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < nowMs) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }
    if (otpRecord.used) {
      return res.status(400).json({ error: 'OTP already used. Please request a new one.' });
    }

    const isValid = await verifyOTP(otpCode, otpRecord.codeHash);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    await otpQueries.markAsUsed(otpRecord.id);

    const deletedAt = new Date();
    const deletionScheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.query(
      `UPDATE "User" SET active=false, "deletedAt"=$1, "deletionScheduledAt"=$2 WHERE id=$3`,
      [deletedAt, deletionScheduledAt, userId]
    );
    await db.query(`DELETE FROM "auth_sessions" WHERE "userId"=$1`, [userId]);

    return res.json({
      success: true,
      deletedAt: deletedAt.toISOString(),
      deletionScheduledAt: deletionScheduledAt.toISOString(),
    });
  } catch (error: any) {
    logger.error('Delete account error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    return res.status(500).json({ error: 'Failed to delete account' });
  }
};