import { Router } from 'express';
import { managedUserCreateSchema, managedUserUpdateSchema } from '../config/schemas.js';
import { t } from '../i18n/index.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import {
  createManagedUser,
  deactivateManagedUser,
  listManagedUsers,
  resendManagedUserInvite,
  updateManagedUser,
} from '../services/userManagementService.js';
import { formatZodError } from '../utils/validation.js';
import { createRequestRateLimit } from '../middlewares/requestRateLimit.js';

export const userManagementRoutes = Router();
const resendInviteRateLimit = createRequestRateLimit({ keyPrefix: 'resend-invite', maxRequests: 10, windowMs: 60_000 });

userManagementRoutes.use(requireAccessToken);

userManagementRoutes.get('/', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;

  try {
    const users = await listManagedUsers(actor);
    return res.json({ users });
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return res.status(403).json({ message: t(req, 'forbiddenManageUsers') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'usersLoadFailed') });
  }
});

userManagementRoutes.post('/', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const parsed = managedUserCreateSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const created = await createManagedUser(actor, parsed.data);
    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return res.status(403).json({ message: t(req, 'forbiddenManageUsers') });
    }
    if (error instanceof Error && error.message === 'EMAIL_IN_USE') {
      return res.status(409).json({ message: t(req, 'managedUserEmailInUse') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'userCreateFailed') });
  }
});

userManagementRoutes.patch('/:id', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: t(req, 'invalidUserId') });
  }

  const parsed = managedUserUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const updated = await updateManagedUser(actor, userId, parsed.data);
    if (!updated) {
      return res.status(404).json({ message: t(req, 'managedUserNotFound') });
    }

    return res.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return res.status(403).json({ message: t(req, 'forbiddenManageUsers') });
    }
    if (error instanceof Error && error.message === 'EMAIL_IN_USE') {
      return res.status(409).json({ message: t(req, 'managedUserEmailInUse') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'userUpdateFailed') });
  }
});

userManagementRoutes.delete('/:id', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: t(req, 'invalidUserId') });
  }

  try {
    const updated = await deactivateManagedUser(actor, userId);
    if (!updated) {
      return res.status(404).json({ message: t(req, 'managedUserNotFound') });
    }

    return res.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return res.status(403).json({ message: t(req, 'forbiddenManageUsers') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'userDeleteFailed') });
  }
});

userManagementRoutes.post('/:id/resend-invite', resendInviteRateLimit, async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: t(req, 'invalidUserId') });
  }

  try {
    await resendManagedUserInvite(actor, userId);
    return res.json({ message: t(req, 'userInviteResendSuccess') });
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return res.status(403).json({ message: t(req, 'forbiddenManageUsers') });
    }
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: t(req, 'managedUserNotFound') });
    }
    if (error instanceof Error && error.message === 'ALREADY_VERIFIED') {
      return res.status(409).json({ message: t(req, 'userInviteAlreadyVerified') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'userInviteResendFailed') });
  }
});
