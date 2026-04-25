import { Router } from 'express';
import { t } from '../i18n/index.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import {
  canManageAccountSettings,
  canManageSystemSettings,
  getAccountSettings,
  getSystemSettings,
  getUserSettings,
  updateAccountSettings,
  updateSystemSettings,
  updateUserSettings,
} from '../services/settingsService.js';

export const settingsRoutes = Router();

settingsRoutes.get('/system', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  if (!canManageSystemSettings(user.role)) {
    return res.status(403).json({ message: t(req, 'forbiddenSystemSettings') });
  }

  return res.json(await getSystemSettings());
});

settingsRoutes.put('/system', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  if (!canManageSystemSettings(user.role)) {
    return res.status(403).json({ message: t(req, 'forbiddenSystemSettings') });
  }

  const updated = await updateSystemSettings(req.body);
  if (!updated) {
    return res.status(400).json({ message: t(req, 'invalidPayloadSystemSettings') });
  }

  return res.json(updated);
});

settingsRoutes.get('/account', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  if (!canManageAccountSettings(user.role)) {
    return res.status(403).json({ message: t(req, 'forbiddenAccountSettings') });
  }

  return res.json(await getAccountSettings(user));
});

settingsRoutes.put('/account', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  if (!canManageAccountSettings(user.role)) {
    return res.status(403).json({ message: t(req, 'forbiddenAccountSettings') });
  }

  const updated = await updateAccountSettings(user, req.body);
  if (!updated) {
    return res.status(400).json({ message: t(req, 'invalidPayloadAccountSettings') });
  }

  return res.json(updated);
});

settingsRoutes.get('/user', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  return res.json(await getUserSettings(user));
});

settingsRoutes.put('/user', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const updated = await updateUserSettings(user, req.body);
  if (!updated) {
    return res.status(400).json({ message: t(req, 'invalidPayloadUserSettings') });
  }

  return res.json(updated);
});
