import { Router } from 'express';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import { getSettings, updateSettings } from '../services/settingsService.js';

export const settingsRoutes = Router();

settingsRoutes.get('/', requireAccessToken, (req, res) => {
  const user = (req as AuthedRequest).user;
  return res.json(getSettings(user.id));
});

settingsRoutes.put('/', requireAccessToken, (req, res) => {
  const user = (req as AuthedRequest).user;
  const updated = updateSettings(user.id, req.body);
  if (!updated) {
    return res.status(400).json({ message: 'Invalid settings payload' });
  }

  return res.json(updated);
});
