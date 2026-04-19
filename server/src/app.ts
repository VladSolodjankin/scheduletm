import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { authRoutes } from './routes/authRoutes.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { integrationRoutes } from './routes/integrationRoutes.js';
import { settingsRoutes } from './routes/settingsRoutes.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(morgan('dev'));
  app.use(cors({ origin: env.APP_URL, credentials: true }));
  app.use(express.json({ limit: '32kb' }));

  app.use(healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/integrations', integrationRoutes);

  app.use((_req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  return app;
};
