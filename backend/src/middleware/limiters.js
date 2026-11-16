import { rateLimit } from 'express-rate-limit';

const opts = (windowMs, max) => ({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessayez plus tard' },
});

// Garde-fou global anti-flood sur toute l'API (par IP).
export const globalLimiter = rateLimit(opts(60 * 1000, 300));

// Proxy Scryfall (recherche + autocomplétion) : protège la clé/IP Scryfall.
export const searchLimiter = rateLimit(opts(60 * 1000, 90));

// Imports CSV : rares et coûteux (résolution Scryfall en masse).
export const importLimiter = rateLimit(opts(15 * 60 * 1000, 10));

// Exports (génération PDF surtout) : coûteux en CPU.
export const exportLimiter = rateLimit(opts(60 * 1000, 20));

// Vérification manuelle des mises à jour : quota GitHub non authentifié = 60 req/h par IP.
export const updateCheckLimiter = rateLimit(opts(60 * 60 * 1000, 10));
