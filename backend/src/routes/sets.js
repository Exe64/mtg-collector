import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { cached } from '../services/cache.js';
import * as scryfall from '../services/scryfall.js';
import { toClientSet, upsertSets } from '../services/sets.js';
import { toClientCard } from '../services/cards.js';

const router = Router();

// GET /api/sets?type=expansion   (cache Redis 24h + persistance en base)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const data = await cached('scry:sets', 86400, async () => {
      const fresh = await scryfall.getSets();
      if (fresh?.data) await upsertSets(fresh.data);
      return fresh;
    });
    let sets = (data?.data || []).map(toClientSet);
    if (req.query.type) sets = sets.filter((s) => s.set_type === req.query.type);
    res.json({ sets });
  } catch (err) {
    next(err);
  }
});

// GET /api/sets/:code/cards?page=1   (pagination native Scryfall, 175/page — cache 6h)
router.get('/:code/cards', requireAuth, async (req, res, next) => {
  try {
    const { code } = req.params;
    const page = Number(req.query.page || 1);
    const key = `scry:set:${code}:cards:${page}`;
    const data = await cached(key, 21600, () => scryfall.getSetCards(code, page));
    if (!data) return res.json({ cards: [], total: 0, page, hasMore: false });

    res.json({
      cards: data.data.map(toClientCard),
      total: data.total_cards,
      page,
      hasMore: Boolean(data.has_more),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
