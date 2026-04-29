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
import { trackServerError } from './services/errorTrackingService.js';

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
  app.use(morgan('dev'));
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
  app.use(express.json({ limit: '32kb' }));

  app.use((req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode >= 500) {
        void trackServerError({
          method: req.method,
          path: req.originalUrl,
          error: new Error(`HTTP_${res.statusCode}`),
        });
      }
    });

    next();
  });

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
    res.status(404).json({ message: 'Not found' });
  });

  return app;
};
