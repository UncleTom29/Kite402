import type { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { redis } from '../lib/redis';

const limiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'kite402:rl',
  points: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 100),
  duration: Math.floor(Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000) / 1000),
  blockDuration: 60,
});

export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const key = req.operator?.sub ?? req.ip ?? 'anonymous';
  try {
    await limiter.consume(key);
    next();
  } catch (e) {
    if (e instanceof RateLimiterRes) {
      res.setHeader('Retry-After', String(Math.ceil(e.msBeforeNext / 1000)));
      res.status(429).json({ error: 'Too many requests' });
    } else {
      next();
    }
  }
}
