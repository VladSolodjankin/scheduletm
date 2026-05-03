import { Router } from 'express';
import crypto from 'node:crypto';
import { passwordSchema } from '../config/schemas.js';
import { hashPassword, createOtpCode, verifyPassword } from '../utils/crypto.js';
import { findWebUserById, updateWebUserAuthState, updateWebUserCredentials } from '../repositories/webUserRepository.js';
import { sendEmailVerificationEmail } from '../services/emailDeliveryService.js';
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
  getAccountNotificationDefaults,
  getClientNotificationSettings,
  getEffectiveNotificationSetting,
  getSettingsScopeOptions,
  getSpecialistNotificationSettings,
  putClientNotificationSettings,
  putAccountNotificationDefaults,
  putSpecialistNotificationSettings,
} from '../services/settingsService.js';

export const settingsRoutes = Router();

function parsePositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

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

settingsRoutes.get('/scope-options', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const options = await getSettingsScopeOptions(user);
  if (!options) {
    return res.status(403).json({ message: t(req, 'forbiddenSystemSettings') });
  }

  return res.json(options);
});

settingsRoutes.get('/account', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  if (!canManageAccountSettings(user.role)) {
    return res.status(403).json({ message: t(req, 'forbiddenAccountSettings') });
  }

  const settings = await getAccountSettings(user, parsePositiveInt(req.query.accountId));
  if (!settings) {
    return res.status(400).json({ message: t(req, 'invalidPayloadAccountSettings') });
  }

  return res.json(settings);
});

settingsRoutes.put('/account', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  if (!canManageAccountSettings(user.role)) {
    return res.status(403).json({ message: t(req, 'forbiddenAccountSettings') });
  }

  const updated = await updateAccountSettings(user, req.body, parsePositiveInt(req.query.accountId));
  if (!updated) {
    return res.status(400).json({ message: t(req, 'invalidPayloadAccountSettings') });
  }

  return res.json(updated);
});


settingsRoutes.get('/account-notification-defaults', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  if (!canManageAccountSettings(user.role)) {
    return res.status(403).json({ message: t(req, 'forbiddenAccountSettings') });
  }

  const items = await getAccountNotificationDefaults(user, parsePositiveInt(req.query.accountId));
  if (!items) {
    return res.status(400).json({ message: t(req, 'invalidPayloadAccountSettings') });
  }

  return res.json({ items });
});

settingsRoutes.put('/account-notification-defaults', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  if (!canManageAccountSettings(user.role)) {
    return res.status(403).json({ message: t(req, 'forbiddenAccountSettings') });
  }

  const items = await putAccountNotificationDefaults(user, req.body, parsePositiveInt(req.query.accountId));
  if (!items) {
    return res.status(400).json({ message: t(req, 'invalidPayloadAccountSettings') });
  }

  return res.json({ items });
});

settingsRoutes.get('/specialist-notification-settings', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const specialistId = parsePositiveInt(req.query.specialistId);
  const items = await getSpecialistNotificationSettings(user, specialistId);

  if (!items) {
    return res.status(400).json({ message: t(req, 'invalidPayloadAccountSettings') });
  }

  return res.json({ items });
});

settingsRoutes.put('/specialist-notification-settings', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const specialistId = parsePositiveInt(req.query.specialistId);
  const items = await putSpecialistNotificationSettings(
    user,
    specialistId,
    req.body,
  );

  if (!items) {
    return res.status(400).json({ message: t(req, 'invalidPayloadAccountSettings') });
  }

  return res.json({ items });
});

settingsRoutes.get('/client-notification-settings', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const clientId = parsePositiveInt(req.query.clientId);
  const items = await getClientNotificationSettings(user, clientId);

  if (!items) {
    return res.status(400).json({ message: t(req, 'invalidPayloadAccountSettings') });
  }

  return res.json({ items });
});

settingsRoutes.put('/client-notification-settings', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const clientId = parsePositiveInt(req.query.clientId);
  const items = await putClientNotificationSettings(user, clientId, req.body);

  if (!items) {
    return res.status(400).json({ message: t(req, 'invalidPayloadAccountSettings') });
  }

  return res.json({ items });
});

settingsRoutes.get('/effective-notification-setting', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const notificationType = req.query.notificationType;
  const specialistId = parsePositiveInt(req.query.specialistId);
  const clientId = parsePositiveInt(req.query.clientId);
  const supported = notificationType === 'appointment_created'
    || notificationType === 'appointment_reminder'
    || notificationType === 'payment_reminder';

  if (!supported) {
    return res.status(400).json({ message: t(req, 'invalidPayloadAccountSettings') });
  }

  const item = await getEffectiveNotificationSetting(
    user,
    notificationType,
    specialistId,
    clientId,
  );

  if (!item) {
    return res.status(400).json({ message: t(req, 'invalidPayloadAccountSettings') });
  }

  return res.json(item);
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

  const specialistId = parsePositiveInt(req.query.specialistId);
  const accountId = parsePositiveInt(req.query.accountId);

  const policy = await getSpecialistBookingPolicy(
    user,
    specialistId,
    accountId,
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

  const specialistId = parsePositiveInt(req.query.specialistId);
  const accountId = parsePositiveInt(req.query.accountId);

  const updated = await updateSpecialistBookingPolicy(
    user,
    specialistId,
    req.body,
    accountId,
  );
  if (!updated) {
    return res.status(400).json({ message: t(req, 'invalidPayloadSpecialistBookingPolicy') });
  }

  return res.json(updated);
});


settingsRoutes.post('/user/password/request', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const parsedPassword = passwordSchema.safeParse(req.body?.password);
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  if (!parsedPassword.success || !currentPassword) {
    return res.status(400).json({ message: t(req, 'invalidPayloadUserSettings') });
  }

  const numericUserId = Number(user.id);
  const webUser = Number.isInteger(numericUserId) ? await findWebUserById(user.accountId, numericUserId) : null;
  if (!webUser) {
    return res.status(400).json({ message: t(req, 'invalidUserId') });
  }

  const isCurrentPasswordValid = verifyPassword(currentPassword, webUser.password_salt, webUser.password_hash);
  if (!isCurrentPasswordValid) {
    return res.status(400).json({ message: t(req, 'invalidCurrentPassword') });
  }

  const code = createOtpCode();
  await updateWebUserAuthState({
    accountId: user.accountId,
    id: numericUserId,
    emailVerificationCode: hashPassword(code, webUser.password_salt),
    emailVerificationSentAt: new Date(),
  });
  await sendEmailVerificationEmail({
    to: webUser.email,
    firstName: webUser.first_name ?? undefined,
    verificationCode: code
  });

  return res.json({ message: 'ok' });
})

settingsRoutes.post('/user/password/confirm', requireAccessToken, async (req, res) => {
  const user = (req as AuthedRequest).user;
  const parsedPassword = passwordSchema.safeParse(req.body?.password);
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!parsedPassword.success || !/^\d{4}$/.test(code)) {
    return res.status(400).json({ message: t(req, 'invalidPayloadUserSettings') });
  }

  const numericUserId = Number(user.id);
  const webUser = Number.isInteger(numericUserId) ? await findWebUserById(user.accountId, numericUserId) : null;
  if (!webUser || !webUser.email_verification_code) {
    return res.status(400).json({ message: t(req, 'emailVerificationFailed') });
  }

  const expected = hashPassword(code, webUser.password_salt);
  if (expected !== webUser.email_verification_code) {
    return res.status(400).json({ message: t(req, 'emailVerificationFailed') });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(parsedPassword.data, salt);
  await updateWebUserCredentials(user.accountId, numericUserId, passwordHash, salt);
  await updateWebUserAuthState({ accountId: user.accountId, id: numericUserId, emailVerificationCode: null, emailVerificationSentAt: null });

  return res.json({ message: 'ok' });
});
