import { Router } from 'express';

import { query, withTransaction } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, intParam } from '../middleware/validate.js';
import { collectionAddSchema, collectionAdjustSchema, collectionPatchSchema, collectionBulkSchema } from '../validation/schemas.js';
import { ensureCard } from '../services/cards.js';
import { getCollection, getCollectionTotals, getStats, getPriceMovers, getCollectionGroups } from '../services/collection.js';
import { logChanges, getLog, undoLogEntry, applyDelta, entryChanges, logEntryChanges } from '../services/collectionLog.js';
import { getSettings } from '../services/settings.js';
import { getSnapshots, getSetSnapshots } from '../services/snapshots.js';
import { UNIT_EUR } from '../services/pricing.js';
import { realSet, SET_ALIASES } from '../services/sets.js';

const router = Router();
router.param('id', intParam);
router.use(requireAuth); // toutes les routes /api/collection sont protégées + isolées

const PATCHABLE = ['quantity', 'condition', 'notes', 'finish', 'language', 'location', 'acquired_price', 'acquired_at'];

// GET /api/collection?page&pageSize&sort&order&q&set&color&type&rarity&condition&finish&language
router.get('/', async (req, res, next) => {
  try {
    const [result, stats] = await Promise.all([
      getCollection(req.user.id, req.query),
      getCollectionTotals(req.user.id),
    ]);
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

// GET /api/collection/price-movers?days=7&threshold=20&limit=10  → top hausses/baisses + spikes
router.get('/price-movers', async (req, res, next) => {
  try {
    const s = await getSettings();
    const days = Math.min(Math.max(Number(req.query.days) || s.default_days, 1), 365);
    const threshold = Math.min(Math.max(Number(req.query.threshold) || s.default_threshold, 1), 1000);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 200);
    res.json(await getPriceMovers(req.user.id, days, threshold, limit));
  } catch (err) {
    next(err);
  }
});

// GET /api/collection/log?days=30  → journal des ajouts/retraits (à grouper par jour côté client)
router.get('/log', async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    res.json({ log: await getLog(req.user.id, days) });
  } catch (err) {
    next(err);
  }
});

// POST /api/collection/log/:id/undo  → annule un mouvement (réapplique le delta inverse)
router.post('/log/:id/undo', async (req, res, next) => {
  try {
    const result = await undoLogEntry(req.user.id, Number(req.params.id));
    res.json(result);
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
    // Stats communes : l'alias reprend celles de son édition cible
    for (const [alias, target] of Object.entries(SET_ALIASES)) if (ownedBySet[target]) ownedBySet[alias] = ownedBySet[target];
    res.json({ ownedBySet });
  } catch (err) {
    next(err);
  }
});

// GET /api/collection/hero-arts?limit=12 → { source, cards[] } : cartes au hasard pour les fonds du
// tableau de bord ; tirées de la collection, sinon des rares/mythiques des dernières extensions.
router.get('/hero-arts', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 12, 1), 30);
    const fields = 'c.scryfall_id, c.name, c.image_uri_small, c.color_identity';
    let { rows } = await query(
      `SELECT ${fields} FROM cards c
       WHERE c.id IN (SELECT card_id FROM collection_entries WHERE user_id = $1)
         AND c.image_uri_small IS NOT NULL
       ORDER BY random() LIMIT $2`,
      [req.user.id, limit],
    );
    let source = 'collection';
    if (!rows.length) {
      ({ rows } = await query(
        `SELECT ${fields} FROM cards c
         WHERE c.rarity IN ('rare', 'mythic') AND c.image_uri_small IS NOT NULL
           AND c.set_code IN (SELECT code FROM sets WHERE set_type = 'expansion' AND released_at <= CURRENT_DATE
                              ORDER BY released_at DESC LIMIT 6)
         ORDER BY random() LIMIT $1`,
        [limit],
      ));
      source = 'catalog';
    }
    res.json({ source, cards: rows });
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
      params.push(realSet(req.query.set));
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

// GET /api/collection/printings/:scryfallId  → { printings: [{scryfall_id, set_code, set_name, collector_number, nonfoil, foil}] }
// Toutes les impressions possédées de la même carte (même oracle_id, ou même nom à défaut).
router.get('/printings/:scryfallId', async (req, res, next) => {
  try {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.scryfallId)) {
      return res.json({ printings: [] });
    }
    const { rows } = await query(
      `WITH ref AS (SELECT oracle_id, name FROM cards WHERE scryfall_id = $2::uuid LIMIT 1)
       SELECT c.scryfall_id, c.set_code, c.set_name, c.collector_number,
              COALESCE(SUM(e.quantity) FILTER (WHERE e.finish = 'nonfoil'), 0)::int AS nonfoil,
              COALESCE(SUM(e.quantity) FILTER (WHERE e.finish <> 'nonfoil'), 0)::int AS foil
       FROM collection_entries e JOIN cards c ON c.id = e.card_id, ref
       WHERE e.user_id = $1
         AND (c.oracle_id = ref.oracle_id OR (ref.oracle_id IS NULL AND c.name = ref.name))
       GROUP BY c.scryfall_id, c.set_code, c.set_name, c.collector_number
       ORDER BY c.set_name, c.collector_number`,
      [req.user.id, req.params.scryfallId],
    );
    res.json({ printings: rows });
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

    // Une transaction : la variante est verrouillée (FOR UPDATE) ou upsertée, et
    // le journal n'est écrit que si le mouvement l'est aussi.
    const quantity = await withTransaction(async (client) => {
      const r = await applyDelta(client, req.user.id, card.id, [finish, condition, language, location], d);
      await logChanges(req.user.id, [{ cardId: card.id, delta: r.applied, finish, condition, language, location }], 'adjust', client);
      return r.quantity;
    });
    return res.json({ quantity });
  } catch (err) {
    return next(err);
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
    await logChanges(req.user.id, [{ cardId: card.id, delta: qty, finish: fin, condition, language, location }], 'add');
    res.status(201).json({ entry: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/collection/bulk  (édition en masse d'une sélection)
// Transactionnel : lignes verrouillées, conflits de variante isolés par savepoint,
// changements de variante journalisés ('move').
router.post('/bulk', validateBody(collectionBulkSchema), async (req, res, next) => {
  try {
    const { ids, patch } = req.body;
    const cols = Object.keys(patch);
    const setSql = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const baseParams = cols.map((c) => patch[c]);
    const update = (client, idCond, idParam) => client.query(
      `UPDATE collection_entries SET ${setSql}
       WHERE ${idCond} AND user_id = $${cols.length + 2} RETURNING *`,
      [...baseParams, idParam, req.user.id],
    );

    const result = await withTransaction(async (client) => {
      const { rows: before } = await client.query(
        'SELECT * FROM collection_entries WHERE id = ANY($1::int[]) AND user_id = $2 FOR UPDATE',
        [ids, req.user.id],
      );
      let after;
      let conflicts = 0;
      // Chemin rapide : une seule requête (cas courant, aucun conflit de variante).
      await client.query('SAVEPOINT bulk');
      try {
        ({ rows: after } = await update(client, `id = ANY($${cols.length + 1}::int[])`, ids));
        await client.query('RELEASE SAVEPOINT bulk');
      } catch (e) {
        if (e.code !== '23505') throw e;
        // Conflit → on annule l'UPDATE global et on reprend ligne par ligne.
        await client.query('ROLLBACK TO SAVEPOINT bulk');
        after = [];
        for (const row of before) {
          /* eslint-disable no-await-in-loop */
          await client.query('SAVEPOINT row');
          try {
            after.push(...(await update(client, `id = $${cols.length + 1}`, row.id)).rows);
            await client.query('RELEASE SAVEPOINT row');
          } catch (err) {
            if (err.code !== '23505') throw err;
            await client.query('ROLLBACK TO SAVEPOINT row');
            conflicts += 1;
          }
          /* eslint-enable no-await-in-loop */
        }
      }
      const byId = new Map(before.map((r) => [r.id, r]));
      await logEntryChanges(req.user.id, after.flatMap((r) => entryChanges(byId.get(r.id), r)), client);
      return { updated: after.length, conflicts };
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/collection/:id  (transactionnel : ligne verrouillée, journal quantité + déplacement)
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
    params.push(req.params.id, req.user.id);

    const entry = await withTransaction(async (client) => {
      const { rows: [before] } = await client.query(
        'SELECT * FROM collection_entries WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [req.params.id, req.user.id],
      );
      if (!before) return null;
      const { rows: [after] } = await client.query(
        `UPDATE collection_entries SET ${sets.join(', ')}
         WHERE id = $${params.length - 1} AND user_id = $${params.length}
         RETURNING *`,
        params,
      );
      await logEntryChanges(req.user.id, entryChanges(before, after), client);
      return after;
    });
    if (!entry) return res.status(404).json({ error: 'Entrée introuvable' });
    return res.json({ entry });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Une entrée identique (finition/état/langue/emplacement) existe déjà' });
    }
    return next(err);
  }
});

// DELETE /api/collection/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      'DELETE FROM collection_entries WHERE id = $1 AND user_id = $2 RETURNING card_id, quantity, finish, condition, language, location',
      [req.params.id, req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Entrée introuvable' });
    const r = rows[0];
    await logChanges(req.user.id, [{ cardId: r.card_id, delta: -r.quantity, finish: r.finish, condition: r.condition, language: r.language, location: r.location }], 'delete');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
