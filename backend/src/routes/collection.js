import { Router } from 'express';

import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { collectionAddSchema, collectionAdjustSchema, collectionPatchSchema, collectionBulkSchema } from '../validation/schemas.js';
import { ensureCard } from '../services/cards.js';
import { getCollection, getCollectionTotals, getStats, getSpikes, getCollectionGroups } from '../services/collection.js';
import { getSnapshots, getSetSnapshots } from '../services/snapshots.js';
import { UNIT_EUR } from '../services/pricing.js';

const router = Router();
router.use(requireAuth); // toutes les routes /api/collection sont protégées + isolées

const PATCHABLE = ['quantity', 'condition', 'notes', 'finish', 'language', 'location', 'acquired_price', 'acquired_at'];

// GET /api/collection?page&pageSize&sort&order&q&set&color&type&rarity&condition&finish&language
router.get('/', async (req, res, next) => {
  try {
    const result = await getCollection(req.user.id, req.query);
    const stats = await getCollectionTotals(req.user.id);
    res.json({ ...result, stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/collection/groups?by=set|color|rarity|location  → groupes (toute la collection) + stats
router.get('/groups', async (req, res, next) => {
  try {
    const by = ['set', 'color', 'rarity', 'location'].includes(req.query.by) ? req.query.by : 'set';
    const [groups, stats] = await Promise.all([
      getCollectionGroups(req.user.id, req.query, by),
      getCollectionTotals(req.user.id),
    ]);
    res.json({ by, groups, stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/collection/stats
router.get('/stats', async (req, res, next) => {
  try {
    res.json(await getStats(req.user.id));
  } catch (err) {
    next(err);
  }
});

// GET /api/collection/spikes?days=7&threshold=20  → mouvements de prix marquants
router.get('/spikes', async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 365);
    const threshold = Math.min(Math.max(Number(req.query.threshold) || 20, 1), 1000);
    res.json({ spikes: await getSpikes(req.user.id, days, threshold) });
  } catch (err) {
    next(err);
  }
});

// GET /api/collection/snapshots?days=90
router.get('/snapshots', async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 90, 365);
    res.json({ snapshots: await getSnapshots(req.user.id, days) });
  } catch (err) {
    next(err);
  }
});

// GET /api/collection/set-snapshots?set=CODE&days=90  (courbe de valeur d'une édition)
router.get('/set-snapshots', async (req, res, next) => {
  try {
    if (!req.query.set) return res.json({ snapshots: [] });
    const days = Math.min(Number(req.query.days) || 90, 365);
    res.json({ snapshots: await getSetSnapshots(req.user.id, req.query.set, days) });
  } catch (err) {
    next(err);
  }
});

// GET /api/collection/locations  → { locations: [...] } (emplacements physiques distincts)
router.get('/locations', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT DISTINCT location FROM collection_entries
       WHERE user_id = $1 AND location <> '' ORDER BY location`,
      [req.user.id],
    );
    res.json({ locations: rows.map((r) => r.location) });
  } catch (err) {
    next(err);
  }
});

// GET /api/collection/owned-by-set  → { ownedBySet: { <set_code>: nb cartes distinctes possédées } }
router.get('/owned-by-set', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.set_code, COUNT(DISTINCT c.scryfall_id)::int AS owned,
              COALESCE(SUM((${UNIT_EUR}) * e.quantity), 0)::numeric(12,2) AS value_eur
       FROM collection_entries e JOIN cards c ON c.id = e.card_id
       WHERE e.user_id = $1 AND c.set_code IS NOT NULL
       GROUP BY c.set_code`,
      [req.user.id],
    );
    const ownedBySet = {};
    for (const r of rows) ownedBySet[r.set_code] = { owned: r.owned, value: Number(r.value_eur) };
    res.json({ ownedBySet });
  } catch (err) {
    next(err);
  }
});

// GET /api/collection/owned?set=CODE  → { owned: { <id>: {nonfoil, foil} }, totalEur }
router.get('/owned', async (req, res, next) => {
  try {
    const params = [req.user.id];
    let setCond = '';
    if (req.query.set) {
      params.push(req.query.set);
      setCond = `AND lower(c.set_code) = lower($${params.length})`;
    }
    const { rows } = await query(
      `SELECT c.scryfall_id,
              COALESCE(SUM(e.quantity) FILTER (WHERE e.finish = 'nonfoil'), 0)::int AS nonfoil,
              COALESCE(SUM(e.quantity) FILTER (WHERE e.finish <> 'nonfoil'), 0)::int AS foil,
              COALESCE(SUM((${UNIT_EUR}) * e.quantity), 0)::numeric(12,2) AS value_eur
       FROM collection_entries e JOIN cards c ON c.id = e.card_id
       WHERE e.user_id = $1 ${setCond}
       GROUP BY c.scryfall_id`,
      params,
    );
    const owned = {};
    let totalEur = 0;
    for (const r of rows) {
      owned[r.scryfall_id] = { nonfoil: r.nonfoil, foil: r.foil };
      totalEur += Number(r.value_eur);
    }
    res.json({ owned, totalEur: Number(totalEur.toFixed(2)) });
  } catch (err) {
    next(err);
  }
});

// POST /api/collection/owned-ids  { ids: [...] }  → { owned: { <id>: {nonfoil, foil} } }
router.post('/owned-ids', async (req, res, next) => {
  try {
    // Filtre aux UUID valides (le cast ::uuid[] sur un id malformé renverrait un 500).
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : [])
      .filter((id) => typeof id === 'string' && UUID_RE.test(id))
      .slice(0, 300);
    if (!ids.length) return res.json({ owned: {} });
    const { rows } = await query(
      `SELECT c.scryfall_id,
              COALESCE(SUM(e.quantity) FILTER (WHERE e.finish = 'nonfoil'), 0)::int AS nonfoil,
              COALESCE(SUM(e.quantity) FILTER (WHERE e.finish <> 'nonfoil'), 0)::int AS foil
       FROM collection_entries e JOIN cards c ON c.id = e.card_id
       WHERE e.user_id = $1 AND c.scryfall_id = ANY($2::uuid[])
       GROUP BY c.scryfall_id`,
      [req.user.id, ids],
    );
    const owned = {};
    for (const r of rows) owned[r.scryfall_id] = { nonfoil: r.nonfoil, foil: r.foil };
    return res.json({ owned });
  } catch (err) {
    return next(err);
  }
});

// POST /api/collection/adjust  (+/- rapide sur la variante par défaut nonfoil/NM/en)
router.post('/adjust', validateBody(collectionAdjustSchema), async (req, res, next) => {
  try {
    const { scryfall_id, delta: d, finish, condition, language, location } = req.body;
    const card = await ensureCard(scryfall_id);
    if (!card) return res.status(404).json({ error: 'Carte introuvable' });

    const cur = await query(
      `SELECT id, quantity FROM collection_entries
       WHERE user_id = $1 AND card_id = $2 AND finish = $3 AND condition = $4 AND language = $5 AND location = $6`,
      [req.user.id, card.id, finish, condition, language, location],
    );
    const row = cur.rows[0];

    if (!row) {
      if (d <= 0) return res.json({ quantity: 0 });
      const ins = await query(
        `INSERT INTO collection_entries (user_id, card_id, quantity, finish, condition, language, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING quantity`,
        [req.user.id, card.id, d, finish, condition, language, location],
      );
      return res.json({ quantity: ins.rows[0].quantity });
    }

    const next = row.quantity + d;
    if (next <= 0) {
      await query('DELETE FROM collection_entries WHERE id = $1', [row.id]);
      return res.json({ quantity: 0 });
    }
    await query('UPDATE collection_entries SET quantity = $1 WHERE id = $2', [next, row.id]);
    return res.json({ quantity: next });
  } catch (err) {
    next(err);
  }
});

// POST /api/collection  (lazy upsert de la carte + ajout/incrément de l'entrée)
router.post('/', validateBody(collectionAddSchema), async (req, res, next) => {
  try {
    const { scryfall_id, quantity: qty, finish, foil, condition, language, location, acquired_price, notes } = req.body;
    const fin = finish || (foil ? 'foil' : 'nonfoil');

    const card = await ensureCard(scryfall_id);
    if (!card) return res.status(404).json({ error: 'Carte introuvable sur Scryfall' });

    const { rows } = await query(
      `INSERT INTO collection_entries
         (user_id, card_id, quantity, finish, condition, language, location, acquired_price, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, card_id, finish, condition, language, location)
       DO UPDATE SET quantity = collection_entries.quantity + EXCLUDED.quantity
       RETURNING *`,
      [req.user.id, card.id, qty, fin, condition, language, location, acquired_price ?? null, notes ?? null],
    );
    res.status(201).json({ entry: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/collection/bulk  (édition en masse d'une sélection)
router.post('/bulk', validateBody(collectionBulkSchema), async (req, res, next) => {
  try {
    const { ids, patch } = req.body;
    const cols = Object.keys(patch);
    const setSql = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const baseParams = cols.map((c) => patch[c]);

    // Chemin rapide : une seule requête (cas courant, aucun conflit de variante).
    try {
      const { rowCount } = await query(
        `UPDATE collection_entries SET ${setSql}
         WHERE id = ANY($${cols.length + 1}::int[]) AND user_id = $${cols.length + 2}`,
        [...baseParams, ids, req.user.id],
      );
      return res.json({ updated: rowCount, conflicts: 0 });
    } catch (e) {
      if (e.code !== '23505') throw e;
      // Conflit détecté → l'UPDATE global a été annulé (autocommit) ; on reprend
      // ligne par ligne pour appliquer le maximum et compter les conflits.
    }

    let updated = 0;
    let conflicts = 0;
    for (const id of ids) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const { rowCount } = await query(
          `UPDATE collection_entries SET ${setSql} WHERE id = $${cols.length + 1} AND user_id = $${cols.length + 2}`,
          [...baseParams, id, req.user.id],
        );
        updated += rowCount;
      } catch (e) {
        if (e.code === '23505') conflicts += 1; else throw e;
      }
    }
    return res.json({ updated, conflicts });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/collection/:id
router.patch('/:id', validateBody(collectionPatchSchema), async (req, res, next) => {
  try {
    const sets = [];
    const params = [];
    for (const key of PATCHABLE) {
      if (req.body[key] !== undefined) {
        params.push(req.body[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'aucun champ à modifier' });

    params.push(req.params.id);
    const idIdx = params.length;
    params.push(req.user.id);
    const userIdx = params.length;

    const { rows } = await query(
      `UPDATE collection_entries SET ${sets.join(', ')}
       WHERE id = $${idIdx} AND user_id = $${userIdx}
       RETURNING *`,
      params,
    );
    if (!rows[0]) return res.status(404).json({ error: 'Entrée introuvable' });
    res.json({ entry: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Une entrée identique (finition/état/langue) existe déjà' });
    }
    next(err);
  }
});

// DELETE /api/collection/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(
      'DELETE FROM collection_entries WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id],
    );
    if (!rowCount) return res.status(404).json({ error: 'Entrée introuvable' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
