import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './shared/config.js';
import { errorHandler } from './shared/middleware/errorHandler.js';
import { requestLogger } from './shared/middleware/requestLogger.js';

function sendHealth(req, res) {
  res.json({ status: 'ok' });
}

function sendNotFound(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

export function makeApp(moduleRoutes) {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins }));
  app.use(requestLogger);
  app.use(express.json({ limit: '50kb' }));

  app.get('/api/health', sendHealth);

  for (const moduleRoute of moduleRoutes) {
    app.use(moduleRoute.path, moduleRoute.router);
  }

  app.use(sendNotFound);
  app.use(errorHandler);

  return app;
}
