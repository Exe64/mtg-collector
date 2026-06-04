import { Router } from 'express';

import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { ensureCard } from '../services/cards.js';
import { getCollection, getCollectionTotals, getStats } from '../services/collection.js';
import { getSnapshots } from '../services/snapshots.js';

const router = Router();
router.use(requireAuth); // toutes les routes /api/collection sont protégées + isolées

const FINISHES = ['nonfoil', 'foil', 'etched'];
const CONDITIONS = ['MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO'];
const PATCHABLE = ['quantity', 'condition', 'notes', 'finish', 'language', 'acquired_price', 'acquired_at'];

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

// GET /api/collection/stats
router.get('/stats', async (req, res, next) => {
  try {
    res.json(await getStats(req.user.id));
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

// GET /api/collection/owned-by-set  → { ownedBySet: { <set_code>: nb cartes distinctes possédées } }
router.get('/owned-by-set', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.set_code, COUNT(DISTINCT c.scryfall_id)::int AS owned
       FROM collection_entries e JOIN cards c ON c.id = e.card_id
       WHERE e.user_id = $1 AND c.set_code IS NOT NULL
       GROUP BY c.set_code`,
      [req.user.id],
    );
    const ownedBySet = {};
    for (const r of rows) ownedBySet[r.set_code] = r.owned;
    res.json({ ownedBySet });
  } catch (err) {
    next(err);
  }
});

// GET /api/collection/owned?set=CODE  → { owned: { <scryfall_id>: quantité } }
router.get('/owned', async (req, res, next) => {
  try {
    const params = [req.user.id];
    let setCond = '';
    if (req.query.set) {
      params.push(req.query.set);
      setCond = `AND c.set_code = $${params.length}`;
    }
    const { rows } = await query(
      `SELECT c.scryfall_id, SUM(e.quantity)::int AS quantity
       FROM collection_entries e JOIN cards c ON c.id = e.card_id
       WHERE e.user_id = $1 ${setCond}
       GROUP BY c.scryfall_id`,
      params,
    );
    const owned = {};
    for (const r of rows) owned[r.scryfall_id] = r.quantity;
    res.json({ owned });
  } catch (err) {
    next(err);
  }
});

// POST /api/collection/adjust  (+/- rapide sur la variante par défaut nonfoil/NM/en)
router.post('/adjust', async (req, res, next) => {
  try {
    const { scryfall_id, delta = 1, finish = 'nonfoil', condition = 'NM', language = 'en' } = req.body || {};
    if (!scryfall_id) return res.status(400).json({ error: 'scryfall_id requis' });
    const d = Number(delta);
    if (!Number.isInteger(d) || d === 0) return res.status(400).json({ error: 'delta invalide' });

    const card = await ensureCard(scryfall_id);
    if (!card) return res.status(404).json({ error: 'Carte introuvable' });

    const cur = await query(
      `SELECT id, quantity FROM collection_entries
       WHERE user_id = $1 AND card_id = $2 AND finish = $3 AND condition = $4 AND language = $5`,
      [req.user.id, card.id, finish, condition, language],
    );
    const row = cur.rows[0];

    if (!row) {
      if (d <= 0) return res.json({ quantity: 0 });
      const ins = await query(
        `INSERT INTO collection_entries (user_id, card_id, quantity, finish, condition, language)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING quantity`,
        [req.user.id, card.id, d, finish, condition, language],
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
router.post('/', async (req, res, next) => {
  try {
    const { scryfall_id, quantity = 1, finish, foil, condition = 'NM', language = 'en', acquired_price, notes } = req.body || {};
    if (!scryfall_id) return res.status(400).json({ error: 'scryfall_id requis' });

    const fin = finish || (foil ? 'foil' : 'nonfoil');
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: 'quantité invalide' });
    if (!FINISHES.includes(fin)) return res.status(400).json({ error: 'finish invalide' });
    if (!CONDITIONS.includes(condition)) return res.status(400).json({ error: 'condition invalide' });

    const card = await ensureCard(scryfall_id);
    if (!card) return res.status(404).json({ error: 'Carte introuvable sur Scryfall' });

    const { rows } = await query(
      `INSERT INTO collection_entries
         (user_id, card_id, quantity, finish, condition, language, acquired_price, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, card_id, finish, condition, language)
       DO UPDATE SET quantity = collection_entries.quantity + EXCLUDED.quantity
       RETURNING *`,
      [req.user.id, card.id, qty, fin, condition, language, acquired_price ?? null, notes ?? null],
    );
    res.status(201).json({ entry: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/collection/:id
router.patch('/:id', async (req, res, next) => {
  try {
    if (req.body.finish && !FINISHES.includes(req.body.finish)) {
      return res.status(400).json({ error: 'finish invalide' });
    }
    if (req.body.condition && !CONDITIONS.includes(req.body.condition)) {
      return res.status(400).json({ error: 'condition invalide' });
    }

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
