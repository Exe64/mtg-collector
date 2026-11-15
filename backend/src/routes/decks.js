import { Router } from 'express';
import { z } from 'zod';

import { query, withTransaction } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { searchLimiter } from '../middleware/limiters.js';
import { validateBody, intParam } from '../middleware/validate.js';
import {
  deckCreateSchema, deckPatchSchema, deckCardAddSchema, deckCardPatchSchema, DECK_FORMATS,
} from '../validation/schemas.js';
import { ensureCard } from '../services/cards.js';
import { parseDeckText, fetchMoxfieldDeck, checkDeck } from '../services/deckCheck.js';
import { namesToWishlist } from '../services/commanders.js';
import {
  listDecks, getDeck, deckDetail, addCardsByName, decksUsing, printingsOf,
} from '../services/decks.js';

const router = Router();
router.param('id', intParam);
router.param('lineId', intParam);
router.use(requireAuth);

const touch = (db, deckId) => db.query('UPDATE decks SET updated_at = now() WHERE id = $1', [deckId]);

// Liste d'un deck depuis { url } (Moxfield public) ou { text } → { name, format, cards } | null
async function readList({ url, text }) {
  if (url) return fetchMoxfieldDeck(url);
  if (text?.trim()) return { name: null, format: null, cards: parseDeckText(text) };
  return null;
}

// POST /api/decks/check  { url } | { text }  → cartes manquantes vs collection
// (le « peut-être » n'entre pas dans la vérification)
router.post('/check', searchLimiter, async (req, res, next) => {
  try {
    const list = await readList({ url: String(req.body?.url || '').trim(), text: String(req.body?.text || '') });
    if (!list) return res.status(400).json({ error: 'Fournis une URL Moxfield ou une liste de cartes.' });
    const deckCards = list.cards.filter((c) => c.zone !== 'maybe');
    if (!deckCards.length) return res.status(400).json({ error: 'Aucune carte reconnue dans la liste.' });
    return res.json(await checkDeck(req.user.id, deckCards));
  } catch (err) {
    return next(err);
  }
});

// GET /api/decks  → tuiles (image, identité, taille, % possédé)
router.get('/', async (req, res, next) => {
  try {
    res.json({ decks: await listDecks(req.user.id) });
  } catch (err) {
    next(err);
  }
});

// POST /api/decks  { name?, format?, notes?, url? | text? }  → deck vide ou importé
router.post('/', searchLimiter, validateBody(deckCreateSchema), async (req, res, next) => {
  try {
    const list = await readList(req.body);
    if (list && !list.cards.length) return res.status(400).json({ error: 'Aucune carte reconnue dans la liste.' });
    const format = req.body.format || (DECK_FORMATS.includes(list?.format) ? list.format : 'commander');
    const name = req.body.name || list?.name || 'Nouveau deck';
    const result = await withTransaction(async (db) => {
      const { rows } = await db.query(
        'INSERT INTO decks (user_id, name, format, notes) VALUES ($1, $2, $3, $4) RETURNING id',
        [req.user.id, name.slice(0, 200), format, req.body.notes ?? null],
      );
      const unknown = list ? await addCardsByName(db, req.user.id, rows[0].id, list.cards) : [];
      return { id: rows[0].id, unknown };
    });
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /api/decks/by-card/:scryfallId  → decks du compte qui utilisent cette carte (par nom)
router.get('/by-card/:scryfallId', async (req, res, next) => {
  try {
    if (!z.guid().safeParse(req.params.scryfallId).success) return res.status(400).json({ error: 'scryfall_id invalide' });
    const { rows } = await query('SELECT name FROM cards WHERE scryfall_id = $1', [req.params.scryfallId]);
    if (!rows[0]) return res.json({ decks: [] });
    const used = await decksUsing(req.user.id, [rows[0].name]);
    return res.json({ decks: [...used.values()][0] || [] });
  } catch (err) {
    return next(err);
  }
});

// Charge le deck du compte dans req.deck, sinon 404.
async function loadDeck(req, res, next) {
  try {
    req.deck = await getDeck(req.user.id, req.params.id);
    return req.deck ? next() : res.status(404).json({ error: 'Deck introuvable' });
  } catch (err) {
    return next(err);
  }
}

// GET /api/decks/:id  → fiche (possession, coût, légalité)
router.get('/:id', loadDeck, async (req, res, next) => {
  try {
    res.json(await deckDetail(req.user.id, req.deck));
  } catch (err) {
    next(err);
  }
});

// POST /api/decks/:id/missing-to-wishlist  → cartes manquantes (impression la moins chère)
router.post('/:id/missing-to-wishlist', loadDeck, async (req, res, next) => {
  try {
    const { cards } = await deckDetail(req.user.id, req.deck);
    const names = [...new Set(cards.filter((c) => c.missing > 0).map((c) => c.name))];
    const added = await namesToWishlist(req.user.id, names, `Deck ${req.deck.name}`);
    res.json({ added, missing: names.length });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/decks/:id  { name?, format?, notes? }
router.patch('/:id', loadDeck, validateBody(deckPatchSchema), async (req, res, next) => {
  try {
    const { name, format, notes } = req.body;
    await query(
      `UPDATE decks SET name = COALESCE($2, name), format = COALESCE($3, format),
              notes = CASE WHEN $5 THEN $4 ELSE notes END, updated_at = now()
       WHERE id = $1`,
      [req.deck.id, name ?? null, format ?? null, notes ?? null, notes !== undefined],
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/decks/:id
router.delete('/:id', loadDeck, async (req, res, next) => {
  try {
    await query('DELETE FROM decks WHERE id = $1', [req.deck.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /api/decks/:id/cards  { name? | scryfall_id?, quantity?, zone? }  → s'additionne à la ligne existante
router.post('/:id/cards', loadDeck, validateBody(deckCardAddSchema), async (req, res, next) => {
  try {
    const { name, scryfall_id: scryfallId, quantity, zone } = req.body;
    const db = { query };
    const unknown = name ? await addCardsByName(db, req.user.id, req.deck.id, [{ name, quantity, zone }]) : [scryfallId];
    if (unknown.length) {
      const card = scryfallId && await ensureCard(scryfallId);
      if (!card) return res.status(404).json({ error: 'Carte introuvable' });
      await query(
        `INSERT INTO deck_cards (deck_id, card_id, zone, quantity) VALUES ($1, $2, $3, $4)
         ON CONFLICT (deck_id, card_id, zone) DO UPDATE SET quantity = deck_cards.quantity + EXCLUDED.quantity`,
        [req.deck.id, card.id, zone, quantity],
      );
    }
    await touch(db, req.deck.id);
    return res.status(201).json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/decks/:id/cards/:lineId  { quantity?, zone?, scryfall_id? }
// Changer d'impression ou de zone vers une ligne existante fusionne les quantités.
router.patch('/:id/cards/:lineId', loadDeck, validateBody(deckCardPatchSchema), async (req, res, next) => {
  try {
    const card = req.body.scryfall_id ? await ensureCard(req.body.scryfall_id) : null;
    if (req.body.scryfall_id && !card) return res.status(404).json({ error: 'Carte introuvable' });
    const found = await withTransaction(async (db) => {
      const { rows: [line] } = await db.query(
        'SELECT * FROM deck_cards WHERE id = $1 AND deck_id = $2 FOR UPDATE',
        [req.params.lineId, req.deck.id],
      );
      if (!line) return false;
      const cardId = card?.id ?? line.card_id;
      const zone = req.body.zone ?? line.zone;
      const quantity = req.body.quantity ?? line.quantity;
      const { rowCount } = await db.query(
        `UPDATE deck_cards SET quantity = quantity + $4
         WHERE deck_id = $1 AND card_id = $2 AND zone = $3 AND id <> $5`,
        [req.deck.id, cardId, zone, quantity, line.id],
      );
      if (rowCount) await db.query('DELETE FROM deck_cards WHERE id = $1', [line.id]);
      else {
        await db.query(
          'UPDATE deck_cards SET card_id = $2, zone = $3, quantity = $4 WHERE id = $1',
          [line.id, cardId, zone, quantity],
        );
      }
      await touch(db, req.deck.id);
      return true;
    });
    return found ? res.json({ ok: true }) : res.status(404).json({ error: 'Ligne introuvable' });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/decks/:id/cards/:lineId
router.delete('/:id/cards/:lineId', loadDeck, async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM deck_cards WHERE id = $1 AND deck_id = $2', [req.params.lineId, req.deck.id]);
    if (!rowCount) return res.status(404).json({ error: 'Ligne introuvable' });
    await touch({ query }, req.deck.id);
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

// GET /api/decks/:id/cards/:lineId/printings  → impressions de la carte (prix, possédées)
router.get('/:id/cards/:lineId/printings', loadDeck, async (req, res, next) => {
  try {
    const { rows: [line] } = await query(
      'SELECT c.name FROM deck_cards dc JOIN cards c ON c.id = dc.card_id WHERE dc.id = $1 AND dc.deck_id = $2',
      [req.params.lineId, req.deck.id],
    );
    if (!line) return res.status(404).json({ error: 'Ligne introuvable' });
    return res.json({ printings: await printingsOf(req.user.id, line.name) });
  } catch (err) {
    return next(err);
  }
});

export default router;
