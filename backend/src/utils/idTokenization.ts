/**
 * ============================================================================
 * ID TOKENIZATION SYSTEM - MVP Identity Engine
 * ============================================================================
 * 
 * SECURITY RULES:
 * 
 * 1. NEVER expose raw database IDs in:
 *    - Public URLs
 *    - API responses (use sanitize* functions)
 *    - HTML attributes
 *    - JavaScript variables in EJS templates
 *    - localStorage/sessionStorage
 * 
 * 2. ALWAYS use sanitization functions:
 *    - sanitizeUser() for user objects
 *    - sanitizeEvent() for event objects
 *    - sanitizeInvite() for invite objects
 * 
 * 3. ALWAYS validate tokens before use:
 *    - Use validateAndDetokenize() for basic validation
 * 
 * 4. ALWAYS log token operations:
 *    - Invalid tokens are logged automatically
 *    - Expired tokens are logged automatically
 *    - Successful detokenization is logged for audit
 * 
 * ============================================================================
 */

// backend/src/utils/idTokenization.ts
import logger from '../config/logger';
import crypto from 'crypto';

// ✅ SECURITY: Fail in production if ID_TOKEN_SECRET is missing
// Only fail if APP_ENV is explicitly set to 'prod' (not just NODE_ENV=production)
const SECRET_KEY = process.env.ID_TOKEN_SECRET;
const APP_ENV_EXPLICIT = process.env.APP_ENV;
const isProduction = APP_ENV_EXPLICIT === 'prod';

if (!SECRET_KEY) {
  if (isProduction) {
    throw new Error('ID_TOKEN_SECRET environment variable is required in production');
  }
}
const SECRET_KEY_FINAL = SECRET_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm'; // Better than CBC for security

/**
 * Resource types that can be tokenized
 * - 'user': User IDs
 * - 'event': Event IDs (optional, currently using 'user' as fallback)
 * - 'invite': Invite IDs (optional, currently using 'user' as fallback)
 */
export type ResourceType = 'user' | 'event' | 'invite';

interface TokenizedIdV1 {
  type: ResourceType;
  id: string;
  timestamp: number;
}

/**
 * Convert internal ID to secure public token
 * ✅ v2: Uses deterministic HMAC signing (same id/type => same token always)
 * This ensures tokens match across page loads and API responses
 * 
 * @param id - Internal database ID
 * @param type - Resource type ('user' | 'event' | 'invite')
 * @returns Base64URL-encoded token safe for URLs (format: v2.<data>.<signature>)
 * 
 * @example
 * const token = tokenizeId('user-123', 'user');
 * // Returns: 'v2.dXNlcjp1c2VyLTEyMw...' (deterministic token)
 */
// ✅ v2 helpers (deterministic)
function hmacSign(input: string): string {
  return crypto.createHmac('sha256', SECRET_KEY_FINAL).update(input).digest('base64url');
}

export function tokenizeId(id: string, type: ResourceType = 'user'): string {
  try {
    // ✅ v2 deterministic token: same id/type => same token always
    const data = `${type}:${id}`;
    const dataB64 = Buffer.from(data, 'utf8').toString('base64url');
    const sig = hmacSign(dataB64);
    return `v2.${dataB64}.${sig}`;
  } catch (error) {
    throw new Error('Failed to tokenize ID');
  }
}

/**
 * Convert public token back to internal ID
 * 
 * @param token - Base64URL-encoded token
 * @returns Object with { id: string, type: string } or null if invalid/expired
 * 
 * @example
 * const decoded = detokenizeId('eyJ...');
 * // Returns: { id: 'user-123', type: 'user' } or null
 */
// Line 71-102: ENHANCE detokenizeId with logging
export function detokenizeId(token: string, context?: { userId?: string; endpoint?: string }): { id: string; type: string } | null {
  try {
    // ✅ v2 parse (deterministic tokens)
    if (token.startsWith('v2.')) {
      const parts = token.split('.');
      if (parts.length !== 3) {
        logger.warn('detokenizeId(v2): Malformed token structure', {
          tokenLength: token.length,
          context: context || {}
        });
        return null;
      }

      const [, dataB64, sig] = parts;
      const expected = hmacSign(dataB64);
      
      // Use timing-safe comparison to prevent timing attacks
      const sigBuf = Buffer.from(sig, 'base64url');
      const expectedBuf = Buffer.from(expected, 'base64url');
      
      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        logger.warn('detokenizeId(v2): Bad signature', {
          context: context || {}
        });
        return null;
      }

      const data = Buffer.from(dataB64, 'base64url').toString('utf8'); // "type:id"
      const idx = data.indexOf(':');
      if (idx <= 0) {
        logger.warn('detokenizeId(v2): Invalid data format', {
          context: context || {}
        });
        return null;
      }

      const type = data.slice(0, idx);
      const id = data.slice(idx + 1);
      
      // ✅ PHASE 6: Add success logging for security audit
      if (context?.endpoint) {
        logger.info('detokenizeId(v2): Success', {
          tokenType: type,
          endpoint: context.endpoint,
          userId: context.userId
        });
      }
      
      return { id, type };
    }

    // ✅ v1 fallback (your existing AES-GCM decrypt logic for backward compatibility)
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [ivHex, authTagHex, encrypted] = decoded.split(':');
    
    if (!ivHex || !authTagHex || !encrypted) {
      // ✅ PHASE 6: Add logging for malformed tokens
      logger.warn('detokenizeId(v1): Malformed token structure', {
        tokenLength: token.length,
        context: context || {}
      });
      return null;
    }
    
    const key = crypto.scryptSync(SECRET_KEY_FINAL, 'salt', 32);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    const payload: TokenizedIdV1 = JSON.parse(decrypted);
    
    // Optional: Check token expiry (e.g., 1 year)
    const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year
    if (Date.now() - payload.timestamp > maxAge) {
      // ✅ PHASE 6: Add logging for expired tokens
      logger.warn('detokenizeId(v1): Token expired', {
        tokenType: payload.type,
        age: Date.now() - payload.timestamp,
        context: context || {}
      });
      return null; // Token expired
    }
    
    // ✅ PHASE 6: Add success logging for security audit
    if (context?.endpoint) {
      logger.info('detokenizeId(v1): Success', {
        tokenType: payload.type,
        endpoint: context.endpoint,
        userId: context.userId
      });
    }
    
    return { id: payload.id, type: payload.type };
  } catch (error) {
    // ✅ PHASE 6: Enhanced error logging
    logger.error('detokenizeId: failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context: context || {}
    });
    return null;
  }
}

/**
 * ============================================================================
 * SANITIZATION FUNCTIONS
 * ============================================================================
 * 
 * Rules for sanitization:
 * 1. All sanitize functions MUST:
 *    - Remove raw DB `id` fields
 *    - Replace with `publicId` (tokenized version)
 *    - Tokenize all foreign key IDs (userId, etc.)
 *    - Remove sensitive fields (passwords, internal IDs, etc.)
 * 
 * 2. Public routes & HTML:
 *    - Use `publicHandle` (for pretty URLs) OR `publicId` (opaque token)
 *    - NEVER embed raw DB `id` in HTML, URL, localStorage, etc.
 * 
 * 3. APIs:
 *    - Accept `publicId` in URL/body, use `detokenizeId` to map back to DB id
 *    - Return `publicId` fields in JSON; avoid raw `id` unless admin-only
 * 
 * 4. Resource type mapping:
 *    - User → 'user'
 *    - Event → 'user' (events belong to users)
 *    - Invite → 'user' (invites are user-related)
 */

/**
 * Sanitize user object - remove sensitive fields and tokenize IDs
 * 
 * @param user - User object from database
 * @param includeEmail - Whether to include email (default: false, only for admin)
 * @returns Sanitized user object with publicId instead of id
 */
export function sanitizeUser(user: any, includeEmail: boolean = false): any {
  if (!user) return null;
  
  const sanitized: any = {
    handle: user.handle,
    name: user.name,
    createdAt: user.createdAt,
    profileImage: user.profileImage,
    bio: user.bio
  };
  
  // Only include email if explicitly needed (e.g., admin views)
  if (includeEmail && user.email) {
    sanitized.email = user.email;
  }
  
  // Tokenize ID
  if (user.id) {
    sanitized.publicId = tokenizeId(user.id, 'user');
  }
  
  // Remove sensitive fields
  delete sanitized.password;
  delete sanitized.passwordHash;
  delete sanitized.internalId;
  delete sanitized.id; // Remove original ID
  
  return sanitized;
}

/**
 * Sanitize event object
 * 
 * @param event - Event object from database
 * @returns Sanitized event object with publicId and publicUserId
 * 
 * Note: Events use 'user' type since they belong to users
 */
export function sanitizeEvent(event: any): any {
  if (!event) return null;
  
  const sanitized: any = {
    type: event.type,
    meta: event.meta,
    createdAt: event.createdAt
  };
  
  // Tokenize IDs
  // Note: Using 'user' type for event.id since events belong to users
  if (event.id) {
    sanitized.publicId = tokenizeId(event.id, 'user');
  }
  if (event.userId) {
    sanitized.publicUserId = tokenizeId(event.userId, 'user');
  }
  
  // Remove original IDs
  delete sanitized.id;
  delete sanitized.userId;
  
  return sanitized;
}

/**
 * Sanitize invite object
 * 
 * @param invite - Invite object from database
 * @returns Sanitized invite object with publicId, publicInviterId, publicAcceptedBy
 * 
 * Note: Invites use 'user' type since they are user-related
 */
export function sanitizeInvite(invite: any): any {
  if (!invite) return null;
  
  const sanitized: any = {
    code: invite.code,
    createdAt: invite.createdAt,
    acceptedAt: invite.acceptedAt
  };
  
  // Tokenize IDs
  // Note: Using 'user' type for invite.id since invites are user-related
  if (invite.id) {
    sanitized.publicId = tokenizeId(invite.id, 'user');
  }
  if (invite.inviterId) {
    sanitized.publicInviterId = tokenizeId(invite.inviterId, 'user');
  }
  if (invite.acceptedBy) {
    sanitized.publicAcceptedBy = tokenizeId(invite.acceptedBy, 'user');
  }
  
  // Remove original IDs
  delete sanitized.id;
  delete sanitized.inviterId;
  delete sanitized.acceptedBy;
  
  return sanitized;
}