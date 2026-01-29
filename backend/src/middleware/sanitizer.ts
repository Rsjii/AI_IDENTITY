/**
 * Enhanced Input Sanitization Middleware
 * Prevents XSS attacks and sanitizes user inputs
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Remove HTML tags while preserving text content
 */
function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

/**
 * Remove script tags and dangerous patterns
 */
function removeScripts(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
    .replace(/<iframe/gi, '')
    .replace(/<object/gi, '')
    .replace(/<embed/gi, '');
}

/**
 * Sanitize a string value
 */
function sanitizeString(value: string, options: { allowHtml?: boolean; escapeHtml?: boolean } = {}): string {
  if (!value || typeof value !== 'string') return '';
  
  let sanitized = value.trim();
  
  // Remove scripts and dangerous patterns
  sanitized = removeScripts(sanitized);
  
  if (options.allowHtml) {
    // If HTML is allowed, just remove scripts (already done)
    return sanitized;
  }
  
  // Strip HTML tags
  sanitized = stripHtmlTags(sanitized);
  
  // Escape HTML if needed
  if (options.escapeHtml !== false) {
    sanitized = escapeHtml(sanitized);
  }
  
  return sanitized;
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any, options: { allowHtml?: boolean; escapeHtml?: boolean } = {}): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj, options);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Sanitize keys too (prevent prototype pollution)
        const sanitizedKey = sanitizeString(key, { escapeHtml: false });
        sanitized[sanitizedKey] = sanitizeObject(obj[key], options);
      }
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Enhanced sanitization middleware
 * Sanitizes req.body, req.query, and req.params
 */
export const enhancedSanitize = (options: { allowHtml?: boolean; escapeHtml?: boolean } = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body, options);
      }
      
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query, options);
      }
      
      if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params, options);
      }
      
      next();
    } catch (error: any) {
      logger.error('Sanitization error:', error);
      // Don't block the request, just log the error
      next();
    }
  };
};

/**
 * Sanitize chat messages specifically (preserves some formatting)
 */
export function sanitizeChatMessage(message: string): string {
  if (!message || typeof message !== 'string') return '';
  
  // Remove scripts
  let sanitized = removeScripts(message);
  
  // Allow basic formatting but strip dangerous tags
  sanitized = sanitized
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
  
  // Trim and return
  return sanitized.trim();
}

/**
 * Validate file upload
 */
export interface FileValidationOptions {
  maxSize?: number; // in bytes
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

export function validateFileUpload(
  file: Express.Multer.File | undefined,
  options: FileValidationOptions = {}
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }
  
  const {
    maxSize = 25 * 1024 * 1024, // 25MB default
    allowedMimeTypes = [],
    allowedExtensions = [],
  } = options;
  
  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`,
    };
  }
  
  // Check MIME type
  if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
    };
  }
  
  // Check extension
  if (allowedExtensions.length > 0) {
    const ext = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`,
      };
    }
  }
  
  // Additional security: verify MIME type matches extension
  const ext = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
  const suspiciousPatterns: Record<string, string[]> = {
    '.exe': ['application/x-msdownload', 'application/x-msdos-program'],
    '.bat': ['application/x-msdos-program'],
    '.sh': ['application/x-sh'],
    '.php': ['application/x-php', 'text/x-php'],
    '.js': ['application/javascript', 'text/javascript'],
  };
  
  if (suspiciousPatterns[ext] && suspiciousPatterns[ext].includes(file.mimetype)) {
    return {
      valid: false,
      error: 'Potentially dangerous file type detected',
    };
  }
  
  return { valid: true };
}

