import { Router } from 'express';

import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { cached } from '../services/cache.js';
import * as scryfall from '../services/scryfall.js';
import { toClientCard, dbCardToClient, ensureCard } from '../services/cards.js';
import { realSet } from '../services/sets.js';

const router = Router();

// GET /api/cards/search?q=&set=&page=   (live Scryfall, cache Redis 1h)
router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const { q = '', set, page = 1 } = req.query;
    let scryQuery = String(q).trim();
    if (set) scryQuery += ` set:${realSet(set)}`;
    scryQuery = scryQuery.trim();
    if (!scryQuery) return res.json({ cards: [], total: 0, page: 1, hasMore: false });

    // unique=cards (défaut) pour l'autocomplete ; unique=prints pour afficher
    // toutes les versions/éditions correspondantes (récentes d'abord).
    const unique = req.query.unique === 'prints' ? 'prints' : 'cards';
    const order = unique === 'prints' ? 'released' : 'name';
    const dir = unique === 'prints' ? 'desc' : 'auto';
    const key = `scry:search:${unique}:${scryQuery}:${page}`;
    const data = await cached(key, 3600, () => scryfall.searchCards(scryQuery, page, { unique, order, dir }));
    if (!data) return res.json({ cards: [], total: 0, page: Number(page), hasMore: false });

    let cards = data.data.map(toClientCard);
    if (unique === 'prints') {
      // include_multilingual renvoie chaque langue comme une impression distincte :
      // une seule ligne par (set, n° de collecteur), anglais préféré.
      const seen = new Map();
      for (const c of cards) {
        const k = `${c.set}:${c.collector_number}`;
        const prev = seen.get(k);
        if (!prev || (prev.lang !== 'en' && c.lang === 'en')) seen.set(k, c);
      }
      cards = [...seen.values()];
    }

    res.json({
      cards,
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

// GET /api/cards/:scryfallId/rulings   (rulings officiels via Scryfall, cache 24h)
router.get('/:scryfallId/rulings', requireAuth, async (req, res, next) => {
  try {
    const id = req.params.scryfallId;
    const data = await cached(`scry:rulings:${id}`, 86400, () => scryfall.getRulings(id));
    const rulings = (data?.data || []).map((r) => ({
      published_at: r.published_at,
      comment: r.comment,
      source: r.source,
    }));
    res.json({ rulings });
  } catch (err) {
    next(err);
  }
});

// GET /api/cards/:scryfallId/price-history   (courbe de prix par carte)
router.get('/:scryfallId/price-history', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT h.snapshot_date, h.eur, h.eur_foil, h.usd
       FROM card_price_history h JOIN cards c ON c.id = h.card_id
       WHERE c.scryfall_id = $1
       ORDER BY h.snapshot_date`,
      [req.params.scryfallId],
    );
    res.json({ history: rows });
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
