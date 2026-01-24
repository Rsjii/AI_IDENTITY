import { Request, Response } from 'express';
import { adminOverview, listUsers, getUserDetail } from './adminDao';

function parseRange(req: Request) {
  const r = String(req.query.range || '7d');
  if (r === 'today' || r === '7d' || r === '30d') return r;
  return '7d';
}

export async function overview(req: Request, res: Response) {
  const range = parseRange(req);
  const data = await adminOverview(range);
  return res.json({ success: true, data });
}

export async function users(req: Request, res: Response) {
  const range = parseRange(req);
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const data = await listUsers(range, q);
  return res.json({ success: true, ...data });
}

export async function userDetail(req: Request, res: Response) {
  const { userId } = req.params as any;
  const data = await getUserDetail(userId);
  return res.json({ success: true, data });
}