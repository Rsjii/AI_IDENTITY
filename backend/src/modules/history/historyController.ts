import { Request, Response } from 'express';
import { rangeToSince, getHistoryOverview, listMirrorRunsForUser } from './historyDao';

function parseRange(req: Request) {
  const r = String(req.query.range || '7d');
  if (r === 'today' || r === '7d' || r === '30d') return r;
  return '7d';
}

export async function overview(req: Request, res: Response) {
  const userId = req.user?.id || req.user?.userId;
  const range = parseRange(req);
  const since = rangeToSince(range);
  const data = await getHistoryOverview(userId, since);
  return res.json({ success: true, range, since, data });
}

export async function runs(req: Request, res: Response) {
  const userId = req.user?.id || req.user?.userId;
  const range = parseRange(req);
  const since = rangeToSince(range);

  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
  const offset = Math.max(0, Number(req.query.offset || 0));

  const rows = await listMirrorRunsForUser(userId, since, limit, offset);
  return res.json({ success: true, range, since, limit, offset, rows });
}