import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { asyncHandler } from '../../middleware/errorHandler';
import { getUserAuthSessions, revokeAuthSession } from '../../services/authSessionService';
import { db } from '../../config/database';

const router = Router();

// All routes require authentication
router.use(requireJWTFromCookie);

// Helper function for better device parsing
function parseDeviceInfo(userAgent: string): { device: string; browser: string; os: string } {
  const ua = userAgent || '';
  
  // OS Detection
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  
  // Browser Detection
  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Opera')) browser = 'Opera';
  
  // Device Type
  let deviceType = 'Desktop';
  if (ua.includes('Mobile') || ua.includes('Android')) deviceType = 'Mobile';
  else if (ua.includes('Tablet') || ua.includes('iPad')) deviceType = 'Tablet';
  
  return {
    device: `${deviceType} (${os})`,
    browser,
    os
  };
}

// GET /api/auth/sessions
// Return active auth sessions (login sessions) for this user
router.get('/', asyncHandler(async (req: any, res) => {
  const userId = req.user?.id;
  const sessionId = req.user?.sessionId; // ✅ Get from JWT
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const sessions = await getUserAuthSessions(userId);

  // Map to frontend-friendly format
  const formattedSessions = sessions.map((s: any) => {
    const deviceInfo = parseDeviceInfo(s.userAgent || '');
    
    // ✅ Better: Match by session ID if available, else fallback to IP+UA
    const currentIP = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const currentUA = req.headers['user-agent'] || '';
    const isCurrent = sessionId 
      ? s.id === sessionId 
      : (s.ipAddress === currentIP && s.userAgent === currentUA);

    return {
      id: s.id,
      device: `${deviceInfo.device} - ${deviceInfo.browser}`,
      deviceInfo: s.deviceInfo || `${deviceInfo.device} - ${deviceInfo.browser}`,
      ipAddress: s.ipAddress || 'Unknown',
      lastActiveAt: s.lastActiveAt ? new Date(s.lastActiveAt).toISOString() : null,
      createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
      expiresAt: s.expiresAt ? new Date(s.expiresAt).toISOString() : null,
      isCurrent,
    };
  });

  return res.json({ success: true, sessions: formattedSessions });
}));

// DELETE /api/auth/sessions/:id
// Revoke an auth session (logs out from that device)
router.delete('/:id', asyncHandler(async (req: any, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const id = String(req.params.id || '');
  if (!id) return res.status(400).json({ error: 'Session id required' });

  await revokeAuthSession(id, userId);

  return res.json({ success: true, message: 'Session revoked successfully' });
}));

// DELETE /api/auth/sessions/all-other
// Revoke all other sessions (keep current session)
router.delete('/all-other', asyncHandler(async (req: any, res) => {
  const userId = req.user?.id;
  const sessionId = req.user?.sessionId; // ✅ Get from JWT
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  if (sessionId) {
    // ✅ Better: Use sessionId if available
    await db.query(
      `UPDATE "auth_sessions"
       SET "revokedAt" = NOW()
       WHERE "userId" = $1
         AND "revokedAt" IS NULL
         AND id != $2`,
      [userId, sessionId]
    );
  } else {
    // Fallback: Use IP + User Agent matching
    const currentIP = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const currentUA = req.headers['user-agent'] || '';
    await db.query(
      `UPDATE "auth_sessions"
       SET "revokedAt" = NOW()
       WHERE "userId" = $1
         AND "revokedAt" IS NULL
         AND NOT ("ipAddress" = $2 AND "userAgent" = $3)`,
      [userId, currentIP, currentUA]
    );
  }

  return res.json({ success: true, message: 'All other sessions revoked successfully' });
}));

export default router;


