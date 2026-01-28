import { Router } from 'express';
import { requireJWTFromCookie } from '../../middleware/jwtCookie';
import { asyncHandler } from '../../middleware/errorHandler';
import { getUserAuthSessions, revokeAuthSession } from '../../services/authSessionService';

const router = Router();

// All routes require authentication
router.use(requireJWTFromCookie);

// GET /api/auth/sessions
// Return active auth sessions (login sessions) for this user
router.get('/', asyncHandler(async (req: any, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const sessions = await getUserAuthSessions(userId);

  // Map to frontend-friendly format
  const formattedSessions = sessions.map((s: any) => {
    // Detect device type from user agent
    const ua = s.userAgent || '';
    let deviceType = 'Unknown';
    if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
      deviceType = 'Mobile';
    } else if (ua.includes('Tablet') || ua.includes('iPad')) {
      deviceType = 'Tablet';
    } else if (ua.includes('Windows') || ua.includes('Mac') || ua.includes('Linux')) {
      deviceType = 'Desktop';
    }

    // Detect browser
    let browser = 'Unknown';
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    // Check if this is the current session (by matching IP and user agent)
    const currentIP = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const currentUA = req.headers['user-agent'] || '';
    const isCurrent = s.ipAddress === currentIP && s.userAgent === currentUA;

    return {
      id: s.id,
      device: `${deviceType} - ${browser}`,
      deviceInfo: s.deviceInfo || `${deviceType} - ${browser}`,
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

export default router;


