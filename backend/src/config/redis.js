import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('error', (err) => {
  console.error('[redis] erreur', err.message);
});

redis.on('connect', () => {
  console.log('[redis] connecté');
});
