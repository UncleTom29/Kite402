import * as dotenv from 'dotenv';
import * as path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { signWebhookPayload } from '@kite402/sdk';
import { appRouter } from './router';
import { createContext } from './lib/trpc';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { passportAuthMiddleware } from './middleware/passportAuth';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app: express.Express = express();

// Security
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));

// Health check (unauthenticated)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/passport/webhook', (req, res) => {
  const body = req.body ?? {};
  const rawBody = JSON.stringify(body);
  const expectedSignature = process.env.WEBHOOK_SECRET
    ? `sha256=${signWebhookPayload(rawBody, process.env.WEBHOOK_SECRET)}`
    : '';
  const signature = req.header('x-kite402-signature');

  if (expectedSignature && signature && signature !== expectedSignature) {
    return res.status(401).json({ ok: false, error: 'invalid signature' });
  }

  const eventType = body.type ?? body.eventType ?? body.event ?? 'unknown';
  console.log('[passport:webhook]', eventType, body);

  return res.json({ ok: true, received: true, eventType });
});

// Auth on all tRPC routes except auth.*
app.use('/trpc', (req, res, next) => {
  const path = req.path.replace('/', '');
  if (path.startsWith('auth.')) return next();
  return authMiddleware(req, res, next);
});

// Passport session validation (for agent-initiated requests)
app.use('/trpc/cards.issue', passportAuthMiddleware);

// Rate limiting
app.use('/trpc', rateLimitMiddleware);

// tRPC
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ path, error }) {
      if (error.code !== 'UNAUTHORIZED' && error.code !== 'NOT_FOUND') {
        console.error(`[tRPC] ${path}:`, error.message);
      }
    },
  }),
);

const PORT = Number(process.env.PORT ?? 4000);

async function start() {
  try {
    await prisma.$connect();
    await redis.connect();
    console.log('[db] connected');
  } catch (err) {
    console.error('[startup] connection error:', err);
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 Kite402 API running on http://localhost:${PORT}`);
    console.log(`   tRPC endpoint: http://localhost:${PORT}/trpc`);
    console.log(`   Health:        http://localhost:${PORT}/health`);
  });
}

start();

export { app };
