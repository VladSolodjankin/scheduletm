import { Router } from 'express';
import { env } from '../config/env.js';
import { loginSchema, registrationSchema } from '../config/schemas.js';
import { blockIfTooManyAttempts } from '../middlewares/loginRateLimit.js';
import {
  authenticateUser,
  clearAttempts,
  issueSession,
  refreshAccess,
  registerFailedAttempt,
  registerUser
} from '../services/authService.js';
import { parseCookies } from '../utils/cookies.js';
import { formatZodError } from '../utils/validation.js';

export const authRoutes = Router();

authRoutes.post('/register', (req, res) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  const user = registerUser(parsed.data.email, parsed.data.password);
  if (!user) {
    return res.status(409).json({
      message: 'Пользователь с таким email уже зарегистрирован',
      errors: {
        email: 'Этот email уже используется'
      }
    });
  }

  const accessToken = issueSession(user.id, res);
  return res.status(201).json({
    message: 'Регистрация прошла успешно',
    accessToken,
    user: { id: user.id, email: user.email }
  });
});

authRoutes.post('/login', blockIfTooManyAttempts, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  const user = authenticateUser(parsed.data.email, parsed.data.password);
  if (!user) {
    registerFailedAttempt(req.ip ?? 'unknown');
    return res.status(401).json({
      message: 'Неверный email или пароль',
      errors: {
        email: 'Проверьте email',
        password: 'Проверьте пароль'
      }
    });
  }

  clearAttempts(req.ip ?? 'unknown');
  const accessToken = issueSession(user.id, res);
  return res.json({
    message: 'Вход выполнен успешно',
    accessToken,
    user: { id: user.id, email: user.email }
  });
});

authRoutes.post('/refresh', (req, res) => {
  const refreshToken = parseCookies(req).get(env.SESSION_COOKIE_NAME);

  if (!refreshToken) {
    return res.status(401).json({
      message: 'Сессия истекла. Войдите снова'
    });
  }

  const userId = refreshAccess(refreshToken);
  if (!userId) {
    return res.status(401).json({
      message: 'Не удалось обновить сессию. Войдите снова'
    });
  }

  const accessToken = issueSession(userId, res);
  return res.json({
    message: 'Сессия обновлена',
    accessToken
  });
});
