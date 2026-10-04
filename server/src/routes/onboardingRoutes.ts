import { Router } from 'express';
import { t } from '../i18n/index.js';
import { requireAccessToken, type AuthedRequest } from '../middlewares/authMiddleware.js';
import {
  completeOnboardingStepForActor,
  dismissOnboardingForActor,
  getOnboardingStatusForActor,
} from '../services/onboardingService.js';
import { trackServerError } from '../services/errorTrackingService.js';

export const onboardingRoutes = Router();

onboardingRoutes.use(requireAccessToken);

onboardingRoutes.get('/', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;

  try {
    const status = await getOnboardingStatusForActor(actor);
    return res.json(status);
  } catch (error) {
    void trackServerError({ actor, method: req.method, path: req.path, error });
    res.locals.errorTracked = true;
    return res.status(500).json({ message: t(req, 'onboardingLoadFailed') });
  }
});

onboardingRoutes.post('/steps/:step', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;

  try {
    const status = await completeOnboardingStepForActor(actor, req.params.step);
    if (!status) {
      return res.status(400).json({ message: t(req, 'onboardingStepInvalid') });
    }
    return res.json(status);
  } catch (error) {
    void trackServerError({ actor, method: req.method, path: req.path, error });
    res.locals.errorTracked = true;
    return res.status(500).json({ message: t(req, 'onboardingLoadFailed') });
  }
});

onboardingRoutes.post('/dismiss', async (req, res) => {
  const actor = (req as unknown as AuthedRequest).user;

  try {
    const status = await dismissOnboardingForActor(actor);
    if (!status) {
      return res.status(403).json({ message: t(req, 'forbiddenOnboarding') });
    }
    return res.json(status);
  } catch (error) {
    void trackServerError({ actor, method: req.method, path: req.path, error });
    res.locals.errorTracked = true;
    return res.status(500).json({ message: t(req, 'onboardingLoadFailed') });
  }
});
