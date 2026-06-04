import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { cached } from '../services/cache.js';
import * as scryfall from '../services/scryfall.js';
import { toClientCard, dbCardToClient, ensureCard } from '../services/cards.js';

const router = Router();

// GET /api/cards/search?q=&set=&page=   (live Scryfall, cache Redis 1h)
router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const { q = '', set, page = 1 } = req.query;
    let scryQuery = String(q).trim();
    if (set) scryQuery += ` set:${set}`;
    scryQuery = scryQuery.trim();
    if (!scryQuery) return res.json({ cards: [], total: 0, page: 1, hasMore: false });

    // unique=prints : remonte TOUTES les éditions/versions de chaque carte (récentes d'abord)
    const key = `scry:search:prints:${scryQuery}:${page}`;
    const data = await cached(key, 3600, () =>
      scryfall.searchCards(scryQuery, page, { unique: 'prints', order: 'released', dir: 'desc' }));
    if (!data) return res.json({ cards: [], total: 0, page: Number(page), hasMore: false });

    res.json({
      cards: data.data.map(toClientCard),
      total: data.total_cards,
      page: Number(page),
      hasMore: Boolean(data.has_more),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/cards/prints?name=...   (toutes les éditions d'une carte)
router.get('/prints', requireAuth, async (req, res, next) => {
  try {
    const name = String(req.query.name || '').trim();
    if (!name) return res.json({ cards: [] });
    const key = `scry:prints:${name.toLowerCase()}`;
    const data = await cached(key, 21600, () => scryfall.searchPrints(name));
    res.json({ cards: (data?.data || []).map(toClientCard) });
  } catch (err) {
    next(err);
  }
});

// GET /api/cards/:scryfallId   (détail, DB-first + lazy upsert)
router.get('/:scryfallId', requireAuth, async (req, res, next) => {
  try {
    const row = await ensureCard(req.params.scryfallId);
    if (!row) return res.status(404).json({ error: 'Carte introuvable' });
    res.json({ card: dbCardToClient(row) });
  } catch (err) {
    next(err);
  }
});

export default router;
