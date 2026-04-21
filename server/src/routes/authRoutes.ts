import { Router } from 'express';
import { env } from '../config/env.js';
import { loginSchema, registrationSchema, specialistUserCreationSchema } from '../config/schemas.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import { blockIfTooManyAttempts } from '../middlewares/loginRateLimit.js';
import {
  authenticateUser,
  clearAttempts,
  createSpecialistUser,
  issueSession,
  logoutSession,
  refreshAccess,
  registerFailedAttempt,
  registerUser
} from '../services/authService.js';
import { WebUserRole } from '../types/webUserRole.js';
import { parseCookies } from '../utils/cookies.js';
import { formatZodError } from '../utils/validation.js';

export const authRoutes = Router();

authRoutes.post('/specialists', requireAccessToken, async (req, res) => {
  const actor = (req as AuthedRequest).user;
  if (actor.role !== WebUserRole.Owner && actor.role !== WebUserRole.Admin) {
    return res.status(403).json({ message: 'Недостаточно прав для создания специалиста' });
  }

  const parsed = specialistUserCreationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const created = await createSpecialistUser(
      actor,
      parsed.data.email,
      parsed.data.password,
      parsed.data.specialistName,
    );

    if (!created) {
      return res.status(409).json({
        message: 'Не удалось создать пользователя специалиста',
        errors: {
          email: 'Этот email уже используется'
        }
      });
    }

    return res.status(201).json({
      message: 'Специалист успешно создан',
      user: {
        id: created.user.id,
        email: created.user.email,
        role: created.user.role,
      },
      specialist: {
        id: created.specialistId,
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось создать специалиста' });
  }
});

authRoutes.post('/register', async (req, res) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const user = await registerUser(parsed.data.email, parsed.data.password);
    if (!user) {
      return res.status(409).json({
        message: 'Пользователь с таким email уже зарегистрирован',
        errors: {
          email: 'Этот email уже используется'
        }
      });
    }

    const accessToken = await issueSession(user.id, res);
    return res.status(201).json({
      message: 'Регистрация прошла успешно',
      accessToken,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось зарегистрировать пользователя' });
  }
});

authRoutes.post('/login', blockIfTooManyAttempts, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const user = await authenticateUser(parsed.data.email, parsed.data.password);
    if (!user) {
      await registerFailedAttempt(req.ip ?? 'unknown');
      return res.status(401).json({
        message: 'Неверный email или пароль',
        errors: {
          email: 'Проверьте email',
          password: 'Проверьте пароль'
        }
      });
    }

    await clearAttempts(req.ip ?? 'unknown');
    const accessToken = await issueSession(user.id, res);
    return res.json({
      message: 'Вход выполнен успешно',
      accessToken,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось выполнить вход' });
  }
});

authRoutes.post('/refresh', async (req, res) => {
  const refreshToken = parseCookies(req).get(env.SESSION_COOKIE_NAME);

  if (!refreshToken) {
    return res.status(401).json({
      message: 'Сессия истекла. Войдите снова'
    });
  }

  const userId = await refreshAccess(refreshToken);
  if (!userId) {
    return res.status(401).json({
      message: 'Не удалось обновить сессию. Войдите снова'
    });
  }

  const accessToken = await issueSession(userId, res);
  return res.json({
    message: 'Сессия обновлена',
    accessToken
  });
});

authRoutes.post('/logout', async (req, res) => {
  const refreshToken = parseCookies(req).get(env.SESSION_COOKIE_NAME);
  const auth = req.headers.authorization;
  const accessToken = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : undefined;

  try {
    await logoutSession(refreshToken, accessToken);
    res.clearCookie(env.SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth'
    });
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Не удалось завершить сессию' });
  }
});
