import { Router } from 'express';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import {
  canManageSystemSettings,
  getSystemSettings,
  getUserSettings,
  updateSystemSettings,
  updateUserSettings,
} from '../services/settingsService.js';

export const settingsRoutes = Router();

settingsRoutes.get('/system', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  if (!canManageSystemSettings(user.role)) {
    return res.status(403).json({ message: 'Недостаточно прав для системных настроек' });
  }

  return res.json(await getSystemSettings());
});

settingsRoutes.put('/system', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  if (!canManageSystemSettings(user.role)) {
    return res.status(403).json({ message: 'Недостаточно прав для системных настроек' });
  }

  const updated = await updateSystemSettings(req.body);
  if (!updated) {
    return res.status(400).json({ message: 'Invalid system settings payload' });
  }

  return res.json(updated);
});

settingsRoutes.get('/user', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  return res.json(await getUserSettings(user.id));
});

settingsRoutes.put('/user', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const updated = await updateUserSettings(user, req.body);
  if (!updated) {
    return res.status(400).json({ message: 'Invalid user settings payload' });
  }

  return res.json(updated);
});
