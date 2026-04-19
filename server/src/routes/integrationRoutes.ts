import { Router } from 'express';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import { markGoogleConnected } from '../services/settingsService.js';

export const integrationRoutes = Router();

integrationRoutes.post('/google/connect', requireAccessToken, (req, res) => {
  const user = (req as AuthedRequest).user;
  return res.json(markGoogleConnected(user.id));
});
