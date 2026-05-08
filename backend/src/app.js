import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import apiRouter from './routes/api.js';
import { discoverUploadsDirPath } from './services/discover-content.js';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

export function createApp() {
  const app = express();
  // Reverse proxy(Nginx) 뒤에서 실제 클라이언트 IP를 신뢰하도록 설정
  app.set('trust proxy', 1);

  const corsOrigin =
    config.corsAllowedOrigins.length > 0
      ? (origin, callback) => {
          if (!origin || config.corsAllowedOrigins.includes(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error('CORS origin is not allowed.'));
        }
      : true;

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  );
  app.use(
    rateLimit({
      windowMs: Math.max(5_000, config.rateLimitWindowMs),
      max: Math.max(50, config.rateLimitMaxRequests),
      standardHeaders: true,
      legacyHeaders: false
    })
  );
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '8mb' }));
  app.use(morgan('dev'));
  app.use('/api/v1/content/uploads', express.static(discoverUploadsDirPath, { fallthrough: true, maxAge: '7d' }));

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
