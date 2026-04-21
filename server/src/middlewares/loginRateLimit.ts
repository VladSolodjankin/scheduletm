import type { NextFunction, Request, Response } from 'express';
import { isLockedIp } from '../services/authService.js';

export const blockIfTooManyAttempts = async (req: Request, res: Response, next: NextFunction) => {
  if (await isLockedIp(req.ip ?? 'unknown')) {
    return res.status(429).json({ message: 'Too many login attempts. Try again later.' });
  }

  return next();
};
