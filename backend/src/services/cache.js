import { redis } from '../config/redis.js';

/**
 * Cache-aside générique sur Redis.
 *   key       : clé Redis
 *   ttl       : durée de vie en secondes
 *   producer  : fonction async appelée uniquement en cas de miss
 * Les valeurs null/undefined ne sont pas mises en cache (404 Scryfall, etc.).
 */
export async function cached(key, ttl, producer) {
  const hit = await redis.get(key);
  if (hit !== null) return JSON.parse(hit);

  const value = await producer();
  if (value !== null && value !== undefined) {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  }
  return value;
}
