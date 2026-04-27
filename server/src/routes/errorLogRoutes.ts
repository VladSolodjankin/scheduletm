import { Router } from 'express';
import { z } from 'zod';
import { t } from '../i18n/index.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import { getErrorLogsForActor, trackWebError } from '../services/errorTrackingService.js';

const listErrorLogsQuerySchema = z.object({
  source: z.enum(['web', 'server']).optional(),
  accountId: z.coerce.number().int().positive().optional(),
});

const createWebErrorSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  stack: z.string().trim().max(6000).optional(),
  path: z.string().trim().max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const errorLogRoutes = Router();

errorLogRoutes.use(requireAccessToken);

errorLogRoutes.get('/', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const parsed = listErrorLogsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ message: t(req, 'invalidPayloadAccountSettings') });
  }

  try {
    const result = await getErrorLogsForActor(actor, parsed.data);
    return res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN_ERROR_LOGS_SCOPE') {
      return res.status(403).json({ message: t(req, 'forbiddenErrorLogsScope') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'errorLogsLoadFailed') });
  }
});

errorLogRoutes.post('/web', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const parsed = createWebErrorSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: t(req, 'invalidPayloadAccountSettings') });
  }

  try {
    await trackWebError({
      actor,
      message: parsed.data.message,
      stack: parsed.data.stack,
      path: parsed.data.path,
      metadata: parsed.data.metadata,
    });

    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: t(req, 'errorLogsCreateFailed') });
  }
});
