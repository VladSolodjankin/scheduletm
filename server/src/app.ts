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

export const createApp = () => {
  const app = express();
  const allowedOrigins = Array.from(new Set([env.APP_URL, 'http://localhost:5173']));

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

  app.use(healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/specialists', specialistRoutes);
  app.use('/api/users', userManagementRoutes);
  app.use('/api/integrations', integrationRoutes);

  app.use((_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  return app;
};
