import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { pool } from './config/db.js';
import { redis } from './config/redis.js';
import { logger } from './config/logger.js';
import authRoutes from './routes/auth.js';
import cardsRoutes from './routes/cards.js';
import setsRoutes from './routes/sets.js';
import collectionRoutes from './routes/collection.js';
import importRoutes from './routes/import.js';
import exportRoutes from './routes/export.js';
import wishlistRoutes from './routes/wishlist.js';
import decksRoutes from './routes/decks.js';
import { scheduleDailyJob } from './services/dailyJob.js';
import { globalLimiter, searchLimiter, importLimiter, exportLimiter } from './middleware/limiters.js';

// Refus de démarrer si les secrets JWT sont absents ou trop faibles (échec rapide,
// plutôt qu'une erreur à la première signature de token).
function validateEnv() {
  const problems = [];
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const v = process.env[key];
    if (!v) problems.push(`${key} manquant`);
    else if (v.length < 32) problems.push(`${key} trop court (< 32 caractères)`);
  }
  if (problems.length) {
    logger.error(`Configuration invalide : ${problems.join(' ; ')}. Démarrage refusé.`);
    process.exit(1);
  }
}
validateEnv();

const app = express();
const PORT = process.env.PORT || 3001;

// Derrière Traefik → nginx (2 hops) : pour voir la vraie IP client (rate-limit, logs).
app.set('trust proxy', 2);

app.use(helmet());
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === '/api/health' },
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Health check (utilisé par le healthcheck Docker)
// ---------------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    const pong = await redis.ping();
    res.json({ status: 'ok', db: 'up', redis: pong === 'PONG' ? 'up' : 'down' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
// Garde-fou global anti-flood (le health check ci-dessus en est exempt).
app.use('/api', globalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/cards', searchLimiter, cardsRoutes);
app.use('/api/sets', setsRoutes);
app.use('/api/collection', collectionRoutes);
app.use('/api/import', importLimiter, importRoutes);
app.use('/api/export', exportLimiter, exportRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/decks', searchLimiter, decksRoutes);

// 404 pour les routes /api inconnues
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// ---------------------------------------------------------------------------
// Gestion d'erreurs centralisée
// ---------------------------------------------------------------------------
app.use((err, req, res, _next) => {
  (req.log || logger).error({ err }, 'erreur requête');
  const status = err.status || 500;
  // En prod, ne pas divulguer les détails internes (schéma DB, stack…) sur les 5xx.
  const expose = status < 500 || process.env.NODE_ENV !== 'production';
  res.status(status).json({ error: expose ? (err.message || 'Erreur interne') : 'Erreur interne' });
});

app.listen(PORT, () => {
  logger.info(`backend à l'écoute sur le port ${PORT}`);
  scheduleDailyJob();
});
