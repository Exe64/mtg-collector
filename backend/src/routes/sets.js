import { Router } from 'express';

import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { cached } from '../services/cache.js';
import * as scryfall from '../services/scryfall.js';
import { toClientSet, dbSetToClient, upsertSets } from '../services/sets.js';
import { toClientCard, dbCardToClient } from '../services/cards.js';

const router = Router();

const SET_COLS = 'code, name, released_at, card_count, icon_uri, set_type, printed_size';

// GET /api/sets?type=expansion   (DB-first ; Scryfall seulement si la table est vide)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ${SET_COLS} FROM sets ORDER BY released_at DESC NULLS LAST`,
    );
    let sets;
    if (rows.length) {
      sets = rows.map(dbSetToClient);
    } else {
      const data = await cached('scry:sets', 86400, async () => {
        const fresh = await scryfall.getSets();
        if (fresh?.data) await upsertSets(fresh.data);
        return fresh;
      });
      sets = (data?.data || []).map(toClientSet);
    }
    if (req.query.type) sets = sets.filter((s) => s.set_type === req.query.type);
    res.json({ sets });
  } catch (err) {
    next(err);
  }
});

// GET /api/sets/:code/cards   (DB-first : toutes les cartes du set, tri par n° de collecteur)
router.get('/:code/cards', requireAuth, async (req, res, next) => {
  try {
    const { code } = req.params;
    const local = await query(
      `SELECT * FROM cards WHERE lower(set_code) = lower($1)
       ORDER BY NULLIF(regexp_replace(collector_number, '[^0-9]', '', 'g'), '')::int NULLS LAST, collector_number`,
      [code],
    );
    if (local.rows.length) {
      return res.json({ cards: local.rows.map(dbCardToClient), total: local.rows.length, page: 1, hasMore: false });
    }
    // Secours Scryfall (set absent de la base — ex. sortie hors dernier sync)
    const page = Number(req.query.page || 1);
    const data = await cached(`scry:set:${code}:cards:${page}`, 21600, () => scryfall.getSetCards(code, page));
    if (!data) return res.json({ cards: [], total: 0, page, hasMore: false });
    return res.json({
      cards: data.data.map(toClientCard),
      total: data.total_cards,
      page,
      hasMore: Boolean(data.has_more),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sets/:code   (détail d'une extension)
router.get('/:code', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT ${SET_COLS} FROM sets WHERE lower(code) = lower($1)`, [req.params.code]);
    if (rows[0]) return res.json({ set: dbSetToClient(rows[0]) });
    const data = await scryfall.getSet(req.params.code);
    if (!data) return res.status(404).json({ error: 'Extension introuvable' });
    return res.json({ set: toClientSet(data) });
  } catch (err) {
    next(err);
  }
});

export default router;
