import { Request, Response } from 'express';
import { userQueries } from '../../config/database';
import { logger } from '../../config/logger';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import {db} from '../../config/database';

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
    });    

    // ✅ FIX: Parse from req.body (multer will parse multipart/form-data)
    const { name, phone, profileImage, timeZone } = updateProfileSchema.parse(req.body);

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

