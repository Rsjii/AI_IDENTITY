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
    if (isApi) return res.status(403).json({ error: 'Forbidden' });
    return res.status(403).render('errors/403', { title: 'Forbidden', csrfToken: res.locals.csrfToken || '' });
  }

  return next();
}