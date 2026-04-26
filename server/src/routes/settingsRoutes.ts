import { Router } from 'express';
import { t } from '../i18n/index.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import {
  canManageAccountSettings,
  canManageSystemSettings,
  getAccountSettings,
  getSystemSettings,
  getSpecialistBookingPolicy,
  getUserSettings,
  updateAccountSettings,
  updateSpecialistBookingPolicy,
  updateSystemSettings,
  updateUserSettings,
  canManageSpecialistBookingPolicies,
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

settingsRoutes.get('/specialist-booking-policy', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  if (!canManageSpecialistBookingPolicies(user.role)) {
    return res.status(403).json({ message: t(req, 'forbiddenSpecialistBookingPolicySettings') });
  }

  const specialistId = typeof req.query.specialistId === 'string'
    ? Number(req.query.specialistId)
    : undefined;

  const policy = await getSpecialistBookingPolicy(
    user,
    Number.isFinite(specialistId) ? specialistId : undefined,
  );

  if (!policy) {
    return res.status(400).json({ message: t(req, 'specialistBookingPolicySpecialistRequired') });
  }

  return res.json(policy);
});

settingsRoutes.put('/specialist-booking-policy', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  if (!canManageSpecialistBookingPolicies(user.role)) {
    return res.status(403).json({ message: t(req, 'forbiddenSpecialistBookingPolicySettings') });
  }

  const specialistId = typeof req.query.specialistId === 'string'
    ? Number(req.query.specialistId)
    : undefined;

  const updated = await updateSpecialistBookingPolicy(
    user,
    Number.isFinite(specialistId) ? specialistId : undefined,
    req.body,
  );
  if (!updated) {
    return res.status(400).json({ message: t(req, 'invalidPayloadSpecialistBookingPolicy') });
  }

  return res.json(updated);
});
