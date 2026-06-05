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
