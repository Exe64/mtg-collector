import express from 'express';
import cookieParser from 'cookie-parser';

import { pool } from './config/db.js';
import { redis } from './config/redis.js';
import authRoutes from './routes/auth.js';
import cardsRoutes from './routes/cards.js';
import setsRoutes from './routes/sets.js';
import collectionRoutes from './routes/collection.js';
import importRoutes from './routes/import.js';
import exportRoutes from './routes/export.js';
import { scheduleDailyJob } from './services/dailyJob.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Derrière nginx : indispensable pour que express-rate-limit voie la vraie IP (#vigilance)
app.set('trust proxy', 1);

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
app.use('/api/auth', authRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/sets', setsRoutes);
app.use('/api/collection', collectionRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);

// 404 pour les routes /api inconnues
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// ---------------------------------------------------------------------------
// Gestion d'erreurs centralisée
// ---------------------------------------------------------------------------
app.use((err, req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Erreur interne' });
});

app.listen(PORT, () => {
  console.log(`[backend] à l'écoute sur le port ${PORT}`);
  scheduleDailyJob();
});
