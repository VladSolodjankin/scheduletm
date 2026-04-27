import { Router } from 'express';
import { z } from 'zod';
import { t } from '../i18n/index.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import {
  getNotificationLogsForActor,
  resendFailedNotificationForActor,
} from '../services/notificationLogService.js';

const listNotificationQuerySchema = z.object({
  accountId: z.coerce.number().int().positive().optional(),
  specialistId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
});

export const notificationRoutes = Router();

notificationRoutes.use(requireAccessToken);

notificationRoutes.get('/', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const parsed = listNotificationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ message: t(req, 'invalidPayloadAccountSettings') });
  }

  try {
    const data = await getNotificationLogsForActor(actor, parsed.data);
    return res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'SPECIALIST_PROFILE_NOT_FOUND' || message === 'FORBIDDEN_NOTIFICATION_SCOPE') {
      return res.status(403).json({ message: t(req, 'forbiddenNotificationScope') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'notificationsLoadFailed') });
  }
});

notificationRoutes.post('/:id/resend', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const notificationId = Number(req.params.id);

  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({ message: t(req, 'invalidNotificationId') });
  }

  try {
    const resent = await resendFailedNotificationForActor(actor, notificationId);
    if (!resent) {
      return res.status(404).json({ message: t(req, 'notificationNotFound') });
    }

    return res.json({ message: t(req, 'notificationResendSuccess') });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'SPECIALIST_PROFILE_NOT_FOUND' || message === 'FORBIDDEN_NOTIFICATION_SCOPE') {
      return res.status(403).json({ message: t(req, 'forbiddenNotificationScope') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'notificationResendFailed') });
  }
});
