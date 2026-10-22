import { Router } from 'express';
import { z } from 'zod';

import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { BASIC_LANDS, frontKey } from '../services/deckCheck.js';
import { startJob, jobState } from '../services/jobRunner.js';
import {
  getCatalog, ownedLegendOracles, ownedFrontNames, cardsByFront, coverage,
} from '../services/commanders.js';
import {
  commanderPage, averageDeck, combos, themes, themeCommanders, refreshCommanderCache,
} from '../services/edhrec.js';

const router = Router();
router.use(requireAuth);

const SHORTLIST_MAX = 4;
const uuid = z.string().uuid({ message: 'oracle_id invalide' });
const startCacheJob = () => startJob('commander-cache', refreshCommanderCache);

async function findCommander(oracleId) {
  if (!uuid.safeParse(oracleId).success) return null;
  return (await getCatalog()).find((c) => c.oracle_id === oracleId) || null;
}

// GET /api/commanders  → catalogue légal + oracle_id des légendes possédées
router.get('/', async (req, res, next) => {
  try {
    const [commanders, owned] = await Promise.all([getCatalog(), ownedLegendOracles(req.user.id)]);
    res.json({ commanders, owned });
  } catch (err) {
    next(err);
  }
});

// GET /api/commanders/collection  → légendes possédées + couverture du deck moyen EDHREC
// (lecture du cache seule ; les manquantes déclenchent le job de fond).
router.get('/collection', async (req, res, next) => {
  try {
    const [catalog, owned, ownedNames] = await Promise.all([
      getCatalog(), ownedLegendOracles(req.user.id), ownedFrontNames(req.user.id),
    ]);
    const mine = new Set(owned);
    const legends = catalog.filter((c) => mine.has(c.oracle_id));
    const decks = await Promise.all(legends.map((c) => (
      c.pairing === 'background' ? null : averageDeck(c.name, { cacheOnly: true })
    )));
    const missingNames = decks.flatMap((d) => (d || []).map(([n]) => n)
      .filter((n) => !ownedNames.has(frontKey(n))));
    const byFront = await cardsByFront(missingNames);

    let pending = 0;
    const commanders = legends.map((c, i) => {
      const deck = decks[i];
      if (deck === undefined) pending += 1;
      const cov = deck ? coverage(deck, ownedNames, byFront) : null;
      return {
        oracle_id: c.oracle_id,
        status: deck === undefined ? 'pending' : deck ? 'ready' : 'unavailable',
        coverage: cov && { pct: cov.pct, owned: cov.owned, total: cov.total, missingEur: cov.missingEur },
      };
    });
    if (pending) startCacheJob();
    res.json({ commanders, pending, running: Boolean(jobState()['commander-cache']?.running) });
  } catch (err) {
    next(err);
  }
});

// GET /api/commanders/themes  → thèmes EDHREC par popularité
router.get('/themes', async (req, res, next) => {
  try {
    res.json({ themes: (await themes()) || [] });
  } catch (err) {
    next(err);
  }
});

// GET /api/commanders/themes/:slug  → oracle_id des commandants du thème (ordre EDHREC)
router.get('/themes/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) return res.status(400).json({ error: 'Thème invalide' });
    const [list, catalog] = await Promise.all([themeCommanders(slug), getCatalog()]);
    const byName = new Map(catalog.map((c) => [c.name.toLowerCase(), c.oracle_id]));
    const commanders = (list || [])
      .map((c) => ({ oracle_id: byName.get(c.name.toLowerCase()), numDecks: c.numDecks }))
      .filter((c) => c.oracle_id);
    return res.json({ commanders });
  } catch (err) {
    return next(err);
  }
});

// GET /api/commanders/shortlist  → présélection ☆ (ordre d'ajout)
router.get('/shortlist', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT oracle_id FROM commander_shortlist WHERE user_id = $1 ORDER BY added_at',
      [req.user.id],
    );
    res.json({ shortlist: rows.map((r) => r.oracle_id), max: SHORTLIST_MAX });
  } catch (err) {
    next(err);
  }
});

// POST /api/commanders/shortlist  { oracle_id }  → 409 au-delà de 4
router.post('/shortlist', validateBody(z.object({ oracle_id: uuid })), async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `INSERT INTO commander_shortlist (user_id, oracle_id)
       SELECT $1, $2 WHERE (SELECT count(*) FROM commander_shortlist WHERE user_id = $1) < $3
       ON CONFLICT DO NOTHING`,
      [req.user.id, req.body.oracle_id, SHORTLIST_MAX],
    );
    if (!rowCount) {
      const { rows } = await query(
        'SELECT 1 FROM commander_shortlist WHERE user_id = $1 AND oracle_id = $2',
        [req.user.id, req.body.oracle_id],
      );
      if (!rows.length) return res.status(409).json({ error: `Présélection pleine (${SHORTLIST_MAX} max).` });
    }
    return res.status(201).json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/commanders/shortlist/:oracleId
router.delete('/shortlist/:oracleId', async (req, res, next) => {
  try {
    if (!uuid.safeParse(req.params.oracleId).success) return res.status(400).json({ error: 'oracle_id invalide' });
    await query(
      'DELETE FROM commander_shortlist WHERE user_id = $1 AND oracle_id = $2',
      [req.user.id, req.params.oracleId],
    );
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

// GET /api/commanders/:oracleId  → fiche : EDHREC, couverture du deck moyen, combos
router.get('/:oracleId', async (req, res, next) => {
  try {
    const cmd = await findCommander(req.params.oracleId);
    if (!cmd) return res.status(404).json({ error: 'Commandant introuvable' });

    const unavailable = [];
    const soft = (p, source) => p.catch(() => { unavailable.push(source); return null; });
    const [ownedNames, page, deck, comboList] = await Promise.all([
      ownedFrontNames(req.user.id),
      soft(commanderPage(cmd.name), 'edhrec'),
      cmd.pairing === 'background' ? null : soft(averageDeck(cmd.name), 'edhrec'),
      soft(combos(cmd.name), 'spellbook'),
    ]);
    const has = (name) => ownedNames.has(frontKey(name));

    const listed = [...(page?.topCards || []), ...(page?.synergyCards || [])].map((c) => c.name);
    const byFront = await cardsByFront([...(deck || []).map(([n]) => n), ...listed]);
    const withCard = (c) => {
      const hit = byFront.get(frontKey(c.name));
      return {
        ...c, owned: has(c.name), scryfall_id: hit?.scryfall_id || null, image: hit?.image_uri_small || null, eur: hit?.eur ?? null,
      };
    };

    const catalog = await getCatalog();
    const byName = new Map(catalog.map((c) => [c.name.toLowerCase(), c]));
    return res.json({
      commander: { ...cmd, owned: has(cmd.name) },
      edhrec: page && {
        slug: page.slug,
        rank: page.rank,
        numDecks: page.numDecks,
        salt: page.salt,
        themes: page.themes,
        topCards: page.topCards.map(withCard),
        synergyCards: page.synergyCards.map(withCard),
        similar: page.similar.map((n) => byName.get(n.toLowerCase())).filter(Boolean)
          .map((c) => ({ ...c, owned: has(c.name) })),
      },
      coverage: deck ? coverage(deck, ownedNames, byFront) : null,
      // Decklist complète du deck moyen (base du % possédé), type pour le regroupement.
      deck: deck && deck.map(([name, qty]) => ({
        ...withCard({ name }),
        qty,
        type_line: byFront.get(frontKey(name))?.type_line || null,
        basic: BASIC_LANDS.has(frontKey(name)),
      })),
      combos: (comboList || []).map((cb) => ({
        ...cb,
        uses: cb.uses.map((u) => ({ ...u, owned: has(u.name) })),
        complete: cb.uses.every((u) => has(u.name)),
      })),
      unavailable: [...new Set(unavailable)],
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/commanders/:oracleId/missing-to-wishlist  → manquantes du deck moyen en wishlist
// (impression la moins chère ; ignore les noms déjà en wishlist, quelle que soit l'impression).
router.post('/:oracleId/missing-to-wishlist', async (req, res, next) => {
  try {
    const cmd = await findCommander(req.params.oracleId);
    if (!cmd) return res.status(404).json({ error: 'Commandant introuvable' });
    const deck = await averageDeck(cmd.name);
    if (!deck) return res.status(404).json({ error: 'Pas de deck moyen EDHREC pour ce commandant.' });

    const { missing } = coverage(deck, await ownedFrontNames(req.user.id));
    const keys = missing.map((m) => frontKey(m.name));
    if (!keys.length) return res.json({ added: 0, missing: 0 });
    const { rowCount } = await query(
      `INSERT INTO wishlist (user_id, card_id, note)
       SELECT $1, x.id, $3 FROM (
         SELECT DISTINCT ON (lower(split_part(name, ' // ', 1))) id, lower(split_part(name, ' // ', 1)) AS k
         FROM cards
         WHERE lower(split_part(name, ' // ', 1)) = ANY($2::text[])
         ORDER BY lower(split_part(name, ' // ', 1)), legal_commander DESC, COALESCE(prices_eur, prices_eur_foil) ASC NULLS LAST
       ) x
       WHERE NOT EXISTS (
         SELECT 1 FROM wishlist w JOIN cards c ON c.id = w.card_id
         WHERE w.user_id = $1 AND lower(split_part(c.name, ' // ', 1)) = x.k
       )
       ON CONFLICT (user_id, card_id) DO NOTHING`,
      [req.user.id, keys, `Deck ${cmd.name}`],
    );
    return res.json({ added: rowCount, missing: keys.length });
  } catch (err) {
    return next(err);
  }
});

export default router;
