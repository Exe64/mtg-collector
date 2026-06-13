import { Router } from 'express';
import { z } from 'zod';

import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ensureCard } from '../services/cards.js';

const router = Router();
router.use(requireAuth);

const addSchema = z.object({
  scryfall_id: z.string().uuid({ message: 'scryfall_id invalide' }),
  note: z.string().max(2000).nullish(),
});

// GET /api/wishlist
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT w.id, w.note, w.added_at,
              c.scryfall_id, c.name, c.set_code, c.set_name, c.image_uri_small, c.rarity,
              c.prices_eur AS eur
       FROM wishlist w JOIN cards c ON c.id = w.card_id
       WHERE w.user_id = $1
       ORDER BY c.prices_eur DESC NULLS LAST`,
      [req.user.id],
    );
    const totalEur = rows.reduce((s, r) => s + (Number(r.eur) || 0), 0);
    res.json({ items: rows, totalEur: Number(totalEur.toFixed(2)) });
  } catch (err) {
    next(err);
  }
});

// GET /api/wishlist/movers?days=7  → variations de prix des cartes de la wishlist
// (baisses en tête = signaux d'achat) sur les `days` derniers jours.
router.get('/movers', async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 365);
    const { rows } = await query(
      `WITH wished AS (
         SELECT DISTINCT c.id AS card_id, c.scryfall_id, c.name, c.set_code, c.image_uri_small
         FROM cards c JOIN wishlist w ON w.card_id = c.id
         WHERE w.user_id = $1
       ),
       latest AS (
         SELECT h.card_id, h.snapshot_date, h.eur
         FROM card_price_history h
         JOIN wished o ON o.card_id = h.card_id
         WHERE h.snapshot_date = (SELECT MAX(snapshot_date) FROM card_price_history h2 WHERE h2.card_id = h.card_id)
       ),
       ref AS (
         SELECT DISTINCT ON (h.card_id) h.card_id, h.eur
         FROM card_price_history h
         JOIN latest l ON l.card_id = h.card_id
         WHERE h.snapshot_date <= l.snapshot_date - $2::int
         ORDER BY h.card_id, h.snapshot_date DESC
       )
       SELECT o.scryfall_id, o.name, o.set_code, o.image_uri_small,
              l.eur AS current_eur, r.eur AS past_eur,
              (l.eur - r.eur)::numeric(10,2) AS diff_eur,
              round(((l.eur - r.eur) / NULLIF(r.eur, 0)) * 100, 1) AS pct
       FROM wished o
       JOIN latest l ON l.card_id = o.card_id
       JOIN ref r ON r.card_id = o.card_id
       WHERE r.eur > 0 AND l.eur IS NOT NULL AND l.eur <> r.eur
       ORDER BY pct ASC
       LIMIT 50`,
      [req.user.id, days],
    );
    res.json({ movers: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/wishlist  { scryfall_id, note? }
router.post('/', validateBody(addSchema), async (req, res, next) => {
  try {
    const card = await ensureCard(req.body.scryfall_id);
    if (!card) return res.status(404).json({ error: 'Carte introuvable' });
    const { rows } = await query(
      `INSERT INTO wishlist (user_id, card_id, note) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, card_id) DO UPDATE SET note = EXCLUDED.note
       RETURNING id`,
      [req.user.id, card.id, req.body.note ?? null],
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/wishlist/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await query(
      'DELETE FROM wishlist WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id],
    );
    if (!rowCount) return res.status(404).json({ error: 'Introuvable' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
