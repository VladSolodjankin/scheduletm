import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { authRoutes } from './routes/authRoutes.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { integrationRoutes } from './routes/integrationRoutes.js';
import { appointmentRoutes } from './routes/appointmentRoutes.js';
import { settingsRoutes } from './routes/settingsRoutes.js';
import { specialistRoutes } from './routes/specialistRoutes.js';
import { userManagementRoutes } from './routes/userManagementRoutes.js';
import { notificationRoutes } from './routes/notificationRoutes.js';
import { errorLogRoutes } from './routes/errorLogRoutes.js';
import { publicPageRoutes } from './routes/publicPageRoutes.js';
import { trackServerError } from './services/errorTrackingService.js';

const getBodyParserErrorStatus = (error: unknown): 400 | 413 | null => {
  if (typeof error !== 'object' || error === null || !('type' in error)) {
    return null;
  }

  if (error.type === 'entity.parse.failed') {
    return 400;
  }
  if (error.type === 'entity.too.large') {
    return 413;
  }
  return null;
};

export const createApp = () => {
  const app = express();
  const allowedOrigins = Array.from(
    new Set(
      env.CORS_ALLOWED_ORIGINS
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  );

  app.disable('x-powered-by');
  app.use(helmet());
  morgan.token('safe-url', (req) => {
    const rawUrl = req.url ?? '/';
    return new URL(rawUrl, 'http://localhost').pathname;
  });
  app.use(morgan(':method :safe-url :status :response-time ms'));
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Not allowed by CORS'));
      }
    })
  );

  app.use((req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode >= 500) {
        void trackServerError({
          method: req.method,
          path: new URL(req.originalUrl, 'http://localhost').pathname,
          error: new Error(`HTTP_${res.statusCode}`),
        });
      }
    });

    next();
  });

  app.use(
    '/api/public-pages',
    express.json({ limit: '256kb' }),
    publicPageRoutes,
    (error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      const status = getBodyParserErrorStatus(error);
      if (status) {
        return res.status(status).json({ code: 'invalid_request' });
      }
      return next(error);
    },
  );
  app.use(express.json({ limit: '32kb' }));

  app.use(healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/specialists', specialistRoutes);
  app.use('/api/users', userManagementRoutes);
  app.use('/api/integrations', integrationRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/error-logs', errorLogRoutes);

  app.use((_req, res) => {
    res.status(404).json({ code: 'not_found' });
  });

  app.use((
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status = getBodyParserErrorStatus(error);
    if (status) {
      return res.status(status).json({ code: 'invalid_request' });
    }

    console.error(error);
    return res.status(500).json({ code: 'internal_error' });
  });

  return app;
};
