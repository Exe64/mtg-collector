import Redis from 'ioredis';
import { logger } from './logger.js';

export const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('error', (err) => {
  logger.error({ err: err.message }, 'erreur redis');
});

redis.on('connect', () => {
  logger.info('redis connecté');
});
