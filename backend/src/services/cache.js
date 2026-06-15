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

// Vide les entrées de cache applicatives (Scryfall, sets, decks Moxfield).
// N'affecte pas les autres données Redis. Retourne le nombre de clés supprimées.
export async function flushScryfallCache() {
  const patterns = ['scry:*', 'set:*', 'sets', 'moxfield:*'];
  let total = 0;
  for (const pattern of patterns) {
    let cursor = '0';
    do {
      // eslint-disable-next-line no-await-in-loop
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = next;
      if (keys.length) {
        // eslint-disable-next-line no-await-in-loop
        await redis.del(...keys);
        total += keys.length;
      }
    } while (cursor !== '0');
  }
  return total;
}
