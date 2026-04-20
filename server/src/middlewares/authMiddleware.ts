import type { NextFunction, Request, Response } from 'express';
import { resolveUserByAccessToken } from '../services/authService.js';
import type { User } from '../types/domain.js';

type AuthedRequest = Request & { user: User };

export const requireAccessToken = async (req: Request, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = await resolveUserByAccessToken(auth.slice('Bearer '.length));
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  (req as AuthedRequest).user = user;
  return next();
};

export type { AuthedRequest };
