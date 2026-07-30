import { Router } from 'express';
import { db } from '../db/knex.js';

export const healthRoutes = Router();

healthRoutes.get('/health', (_req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

healthRoutes.get('/ready', async (_req, res) => {
  try {
    await db.raw('select 1');
    res.json({ ok: true, at: new Date().toISOString() });
  } catch {
    res.status(503).json({ ok: false });
  }
});
