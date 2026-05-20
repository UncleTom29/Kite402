import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  console.error('[Redis] connection error:', err.message);
});
