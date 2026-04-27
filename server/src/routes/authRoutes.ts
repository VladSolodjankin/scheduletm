import { Router, type Request } from 'express';
import { env } from '../config/env.js';
import {
  acceptInviteSchema,
  verifyInviteSchema,
  loginSchema,
  registrationSchema,
  resendEmailVerificationCodeSchema,
  specialistUserCreationSchema,
  verifyEmailSchema,
} from '../config/schemas.js';
import { t } from '../i18n/index.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import { blockIfTooManyAttempts } from '../middlewares/loginRateLimit.js';
import {
  authenticateUser,
  acceptInvite,
  clearAttempts,
  createSpecialistUser,
  issueSession,
  logoutSession,
  refreshAccess,
  registerFailedAttempt,
  registerUser,
  resendUserEmailVerificationCode,
  verifyInvite,
  verifyUserEmail,
} from '../services/authService.js';
import { WebUserRole } from '../types/webUserRole.js';
import { csrfCookieName, parseCookies } from '../utils/cookies.js';
import { formatZodError } from '../utils/validation.js';

export const authRoutes = Router();
const csrfHeaderName = 'x-csrf-token';

const hasValidCsrf = (req: Request, cookies: Map<string, string>) => {
  const csrfHeader = req.headers[csrfHeaderName];
  const csrfValue = typeof csrfHeader === 'string' ? csrfHeader : '';
  const csrfCookie = cookies.get(csrfCookieName(env.SESSION_COOKIE_NAME)) ?? '';
  return csrfValue.length > 0 && csrfValue === csrfCookie;
};

authRoutes.post('/specialists', requireAccessToken, async (req, res) => {
  const actor = (req as AuthedRequest).user;
  if (actor.role !== WebUserRole.Owner && actor.role !== WebUserRole.Admin) {
    return res.status(403).json({ message: t(req, 'forbiddenCreateSpecialist') });
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
        message: t(req, 'specialistUserCreateConflict'),
        errors: {
          email: t(req, 'specialistUserEmailInUse')
        }
      });
    }

    return res.status(201).json({
      message: t(req, 'specialistCreateSuccess'),
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
    return res.status(500).json({ message: t(req, 'specialistCreateFailed') });
  }
});

authRoutes.post('/register', async (req, res) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const user = await registerUser(parsed.data.email, parsed.data.password, parsed.data.timezone);
    if (!user) {
      return res.status(409).json({
        message: t(req, 'userAlreadyRegistered'),
        errors: {
          email: t(req, 'specialistUserEmailInUse')
        }
      });
    }

    return res.status(201).json({
      message: t(req, 'registrationVerificationSent'),
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: t(req, 'registerFailed') });
  }
});

authRoutes.post('/verify-email', async (req, res) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const verified = await verifyUserEmail(parsed.data.email, parsed.data.code);
    if (!verified) {
      return res.status(400).json({
        message: t(req, 'emailVerificationFailed'),
      });
    }

    return res.json({
      message: t(req, 'emailVerificationSuccess'),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: t(req, 'registerFailed') });
  }
});


authRoutes.get('/verify-invite', async (req, res) => {
  const parsed = verifyInviteSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const result = await verifyInvite(parsed.data.email, parsed.data.token);
    if (!result.valid) {
      return res.status(400).json({ message: t(req, 'inviteAcceptFailed') });
    }

    return res.json({
      message: t(req, 'inviteVerifySuccess'),
      invite: {
        email: result.email,
        accountName: result.accountName ?? null,
        firstName: result.firstName ?? null,
        lastName: result.lastName ?? null,
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: t(req, 'registerFailed') });
  }
});

authRoutes.post('/accept-invite', async (req, res) => {
  const parsed = acceptInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const accepted = await acceptInvite(parsed.data.email, parsed.data.token, parsed.data.password, parsed.data.firstName, parsed.data.lastName, parsed.data.telegramUsername);
    if (!accepted) {
      return res.status(400).json({
        message: t(req, 'inviteAcceptFailed'),
      });
    }

    return res.json({
      message: t(req, 'inviteAcceptSuccess'),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: t(req, 'registerFailed') });
  }
});

authRoutes.post('/resend-verification-code', async (req, res) => {
  const parsed = resendEmailVerificationCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const sent = await resendUserEmailVerificationCode(parsed.data.email);
    if (!sent) {
      return res.status(404).json({ message: t(req, 'emailVerificationFailed') });
    }

    return res.json({ message: t(req, 'emailVerificationCodeResent') });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: t(req, 'registerFailed') });
  }
});

authRoutes.post('/login', blockIfTooManyAttempts, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(formatZodError(parsed.error));
  }

  try {
    const user = await authenticateUser(parsed.data.email, parsed.data.password, parsed.data.timezone);
    if (!user) {
      await registerFailedAttempt(req.ip ?? 'unknown');
      return res.status(401).json({
        message: t(req, 'invalidCredentials'),
        errors: {
          email: t(req, 'invalidCredentialsEmailHint'),
          password: t(req, 'invalidCredentialsPasswordHint')
        }
      });
    }

    await clearAttempts(req.ip ?? 'unknown');
    const accessToken = await issueSession(user, res);
    return res.json({
      message: t(req, 'loginSuccess'),
      accessToken,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_NOT_VERIFIED') {
      return res.status(403).json({ message: t(req, 'emailNotVerified') });
    }
    if (error instanceof Error && error.message === 'ACCOUNT_INACTIVE') {
      return res.status(403).json({ message: t(req, 'accountInactive') });
    }

    console.error(error);
    return res.status(500).json({ message: t(req, 'loginFailed') });
  }
});

authRoutes.post('/refresh', async (req, res) => {
  const cookies = parseCookies(req);
  const refreshToken = cookies.get(env.SESSION_COOKIE_NAME);

  if (!refreshToken) {
    return res.status(401).json({
      message: t(req, 'sessionExpired')
    });
  }
  if (!hasValidCsrf(req, cookies)) {
    return res.status(403).json({ message: t(req, 'csrfTokenInvalid') });
  }

  const refreshed = await refreshAccess(refreshToken);
  if (!refreshed) {
    return res.status(401).json({
      message: t(req, 'sessionRefreshFailed')
    });
  }

  const accessToken = await issueSession({ id: refreshed.userId, accountId: refreshed.accountId }, res);
  return res.json({
    message: t(req, 'sessionRefreshed'),
    accessToken
  });
});

authRoutes.post('/logout', async (req, res) => {
  const cookies = parseCookies(req);
  const refreshToken = cookies.get(env.SESSION_COOKIE_NAME);
  const auth = req.headers.authorization;
  const accessToken = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : undefined;
  if (!hasValidCsrf(req, cookies)) {
    return res.status(403).json({ message: t(req, 'csrfTokenInvalid') });
  }

  try {
    await logoutSession(refreshToken, accessToken);
    res.clearCookie(env.SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth'
    });
    res.clearCookie(csrfCookieName(env.SESSION_COOKIE_NAME), {
      httpOnly: false,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth'
    });
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: t(req, 'logoutFailed') });
  }
});
