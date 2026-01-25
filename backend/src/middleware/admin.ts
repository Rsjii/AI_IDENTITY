import { Request, Response, NextFunction } from 'express';
import { ADMIN_EMAILS } from '../config/constants';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const email = req.user?.email;
  const isApi = req.originalUrl.startsWith('/api/');

  if (!email) {
    if (isApi) return res.status(401).json({ error: 'Authentication required' });
    return res.redirect('/auth');
  }

  const ok = ADMIN_EMAILS.includes(String(email).toLowerCase());
  if (!ok) {
    // Return 404 instead of 403 to hide admin endpoints from non-admin users
    if (isApi) return res.status(404).json({ error: 'Not found' });
    return res.status(404).json({ error: 'Page not found' });
  }

  return next();
}