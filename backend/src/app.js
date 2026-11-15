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
import commandersRoutes from './routes/commanders.js';
import alertsRoutes from './routes/alerts.js';
import adminRoutes from './routes/admin.js';
import { globalLimiter, searchLimiter, importLimiter, exportLimiter } from './middleware/limiters.js';

const app = express();

// Nombre de proxys de confiance, pour voir la vraie IP client (rate-limit, logs).
// Défaut 2 = prod Traefik → nginx ; mettre TRUST_PROXY=1 en compose local (nginx seul),
// sinon un client pourrait forger X-Forwarded-For et contourner le rate-limit d'auth.
const trustProxy = process.env.TRUST_PROXY ?? '2';
app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

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
app.use('/api/decks', decksRoutes);
app.use('/api/commanders', commandersRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/admin', adminRoutes);

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

export default app;
