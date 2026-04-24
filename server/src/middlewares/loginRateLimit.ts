import type { NextFunction, Request, Response } from 'express';
import { t } from '../i18n/index.js';
import { isLockedIp } from '../services/authService.js';

export const blockIfTooManyAttempts = async (req: Request, res: Response, next: NextFunction) => {
  if (await isLockedIp(req.ip ?? 'unknown')) {
    return res.status(429).json({ message: t(req, 'tooManyLoginAttempts') });
  }

  return next();
};
