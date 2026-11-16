import { Router } from 'express';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { query, pool } from '../config/db.js';
import { redis } from '../config/redis.js';
import { APP_VERSION } from '../config/version.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getSettings, updateSettings } from '../services/settings.js';
import { jobState, startJob } from '../services/jobRunner.js';
import { flushScryfallCache } from '../services/cache.js';
import { applyPriceSchedule, runDailyJob } from '../services/dailyJob.js';
import { syncBulk, syncFrenchNames } from '../services/bulkData.js';
import { refreshCommanderCache } from '../services/edhrec.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const BACKUP_DIR_RO = process.env.BACKUP_DIR_RO || '/backups';

// Dernière sauvegarde présente dans le dossier monté en lecture seule (si monté).
async function lastBackup() {
  try {
    const files = (await readdir(BACKUP_DIR_RO)).filter((f) => f.startsWith('magic_collection_'));
    if (!files.length) return null;
    const stats = await Promise.all(files.map(async (f) => {
      const s = await stat(join(BACKUP_DIR_RO, f));
      return { name: f, mtime: s.mtimeMs, size: s.size };
    }));
    stats.sort((a, b) => b.mtime - a.mtime);
    const latest = stats[0];
    return {
      name: latest.name,
      at: new Date(latest.mtime).toISOString(),
      sizeBytes: latest.size,
      count: files.length,
      encrypted: latest.name.endsWith('.gpg'),
    };
  } catch {
    return null; // dossier non monté / inaccessible
  }
}

// GET /api/admin/status  → santé, données en base, sauvegardes, jobs, réglages
router.get('/status', async (req, res, next) => {
  try {
    let db = false;
    try { await pool.query('SELECT 1'); db = true; } catch { db = false; }
    let redisUp = false;
    try { redisUp = (await redis.ping()) === 'PONG'; } catch { redisUp = false; }

    const [counts, lastBulk, lastPrice, backup, settings] = await Promise.all([
      query('SELECT (SELECT count(*) FROM cards)::int AS cards, (SELECT count(*) FROM sets)::int AS sets'),
      query('SELECT max(updated_at) AS at FROM cards'),
      query('SELECT max(snapshot_date) AS at FROM collection_snapshots'),
      lastBackup(),
      getSettings(),
    ]);

    res.json({
      version: APP_VERSION,
      health: { db, redis: redisUp },
      data: {
        cards: counts.rows[0].cards,
        sets: counts.rows[0].sets,
        lastBulkSync: lastBulk.rows[0].at,
        lastPriceJob: lastPrice.rows[0].at,
      },
      backup,
      jobs: jobState(),
      settings,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/actions/sync-bulk  (fire-and-forget)
router.post('/actions/sync-bulk', (req, res) => {
  const started = startJob('sync-bulk', () => syncBulk());
  res.status(started ? 202 : 409).json({ started, running: !started });
});

// POST /api/admin/actions/sync-fr  (fire-and-forget : noms français, bulk all_cards)
router.post('/actions/sync-fr', (req, res) => {
  const started = startJob('sync-fr', () => syncFrenchNames());
  res.status(started ? 202 : 409).json({ started, running: !started });
});

// POST /api/admin/actions/price-job  (fire-and-forget)
router.post('/actions/price-job', (req, res) => {
  const started = startJob('price-job', () => runDailyJob());
  res.status(started ? 202 : 409).json({ started, running: !started });
});

// POST /api/admin/actions/commander-cache  (fire-and-forget : EDHREC + Spellbook périmés)
router.post('/actions/commander-cache', (req, res) => {
  const started = startJob('commander-cache', () => refreshCommanderCache());
  res.status(started ? 202 : 409).json({ started, running: !started });
});

// POST /api/admin/actions/flush-cache
router.post('/actions/flush-cache', async (req, res, next) => {
  try {
    const cleared = await flushScryfallCache();
    res.json({ cleared });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users/:id/revoke-sessions  → invalide les sessions d'un compte
// (supprime ses refresh tokens : déconnexion effective dès l'expiration de l'access token, ≤ 30 min)
router.post('/users/:id/revoke-sessions', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Identifiant invalide' });
    const { rowCount } = await query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);
    res.json({ revoked: rowCount });
  } catch (err) {
    next(err);
  }
});

// GET / PUT  /api/admin/settings
router.get('/settings', async (req, res, next) => {
  try {
    res.json(await getSettings());
  } catch (err) {
    next(err);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const settings = await updateSettings(req.body || {});
    applyPriceSchedule(settings.price_job_hours); // applique la périodicité à chaud
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

export default router;
