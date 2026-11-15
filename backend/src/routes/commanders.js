import { Router } from 'express';
import { z } from 'zod';

import { query, withTransaction } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { BASIC_LANDS, frontKey } from '../services/deckCheck.js';
import { startJob, jobState } from '../services/jobRunner.js';
import {
  getCatalog, ownedLegendOracles, ownedFrontNames, cardsByFront, coverage, namesToWishlist,
} from '../services/commanders.js';
import {
  commanderPage, averageDeck, averageDeckVariant, combos, themes, themeCommanders, refreshCommanderCache,
  BRACKETS, BUDGETS,
} from '../services/edhrec.js';
import { addCardsByName } from '../services/decks.js';

const router = Router();
router.use(requireAuth);

const SHORTLIST_MAX = 4;
const uuid = z.guid({ message: 'oracle_id invalide' });
const startCacheJob = () => startJob('commander-cache', refreshCommanderCache);

async function findCommander(oracleId) {
  if (!uuid.safeParse(oracleId).success) return null;
  return (await getCatalog()).find((c) => c.oracle_id === oracleId) || null;
}

// Possession par carte (nom), pas par édition : on pointe l'exemplaire possédé s'il existe,
// sinon l'impression la moins chère (prix d'achat affiché).
function cardView(c, ownedNames, byFront) {
  const hit = byFront.get(frontKey(c.name));
  const mine = ownedNames.get(frontKey(c.name));
  return {
    ...c,
    owned: Boolean(mine),
    scryfall_id: mine?.scryfall_id || hit?.scryfall_id || null,
    image: mine?.image_uri_small || hit?.image_uri_small || null,
    eur: hit?.eur ?? null,
  };
}

// Decklist complète ([[nom, qté]]), type pour le regroupement.
function deckView(deck, ownedNames, byFront) {
  return deck.map(([name, qty]) => ({
    ...cardView({ name }, ownedNames, byFront),
    qty,
    type_line: byFront.get(frontKey(name))?.type_line || null,
    basic: BASIC_LANDS.has(frontKey(name)),
  }));
}

// Variante de deck demandée en query (?theme=&bracket=&budget=) ; null si invalide.
function parseVariant(q) {
  const v = {
    theme: q.theme || undefined, bracket: q.bracket || undefined, budget: q.budget || undefined,
  };
  if (v.theme && !/^[a-z0-9-]{1,80}$/.test(v.theme)) return null;
  if (v.bracket && !BRACKETS.includes(v.bracket)) return null;
  if (v.budget && !BUDGETS.includes(v.budget)) return null;
  return v;
}

// Deck moyen général (celui de « Ma collection ») ou variante EDHREC → { cards, numDecks } | null.
async function loadDeck(cmd, v) {
  if (v.theme || v.bracket || v.budget) return averageDeckVariant(cmd.name, v);
  const cards = await averageDeck(cmd.name);
  return cards && { cards, numDecks: null };
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
    const withCard = (c) => cardView(c, ownedNames, byFront);

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
      // Decklist complète du deck moyen (base du % possédé)
      deck: deck && deckView(deck, ownedNames, byFront),
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

// GET /api/commanders/:oracleId/deck?theme=&bracket=&budget=  → variante du deck moyen
// (thème, niveau de puissance, tranche de prix) : decklist, couverture, nombre de decks.
router.get('/:oracleId/deck', async (req, res, next) => {
  try {
    const cmd = await findCommander(req.params.oracleId);
    if (!cmd) return res.status(404).json({ error: 'Commandant introuvable' });
    const v = parseVariant(req.query);
    if (!v) return res.status(400).json({ error: 'Variante de deck invalide' });

    let found;
    try {
      found = cmd.pairing === 'background' ? null : await loadDeck(cmd, v);
    } catch {
      return res.status(502).json({ error: 'EDHREC indisponible pour le moment.' });
    }
    if (!found) return res.json({ deck: null, coverage: null, numDecks: null });
    const ownedNames = await ownedFrontNames(req.user.id);
    const byFront = await cardsByFront(found.cards.map(([n]) => n));
    return res.json({
      deck: deckView(found.cards, ownedNames, byFront),
      coverage: coverage(found.cards, ownedNames, byFront),
      numDecks: found.numDecks,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/commanders/:oracleId/missing-to-wishlist?theme=&bracket=&budget=
// → manquantes du deck moyen (ou de la variante affichée) en wishlist
// (impression la moins chère ; ignore les noms déjà en wishlist, quelle que soit l'impression).
router.post('/:oracleId/missing-to-wishlist', async (req, res, next) => {
  try {
    const cmd = await findCommander(req.params.oracleId);
    if (!cmd) return res.status(404).json({ error: 'Commandant introuvable' });
    const v = parseVariant(req.query);
    if (!v) return res.status(400).json({ error: 'Variante de deck invalide' });
    const found = await loadDeck(cmd, v);
    if (!found) return res.status(404).json({ error: 'Pas de deck moyen EDHREC pour ce commandant.' });

    const { missing } = coverage(found.cards, await ownedFrontNames(req.user.id));
    const keys = missing.map((m) => frontKey(m.name));
    if (!keys.length) return res.json({ added: 0, missing: 0 });
    const added = await namesToWishlist(req.user.id, keys, `Deck ${cmd.name}`);
    return res.json({ added, missing: keys.length });
  } catch (err) {
    return next(err);
  }
});

// POST /api/commanders/:oracleId/build?theme=&bracket=&budget=  { name? }
// → crée un deck Commander depuis le deck moyen EDHREC (ou la variante affichée).
router.post('/:oracleId/build', validateBody(z.object({ name: z.string().trim().max(200).optional() })), async (req, res, next) => {
  try {
    const cmd = await findCommander(req.params.oracleId);
    if (!cmd) return res.status(404).json({ error: 'Commandant introuvable' });
    const v = parseVariant(req.query);
    if (!v) return res.status(400).json({ error: 'Variante de deck invalide' });
    const found = cmd.pairing === 'background' ? null : await loadDeck(cmd, v);
    if (!found) return res.status(404).json({ error: 'Pas de deck moyen EDHREC pour ce commandant.' });

    const entries = [
      { name: cmd.name, quantity: 1, zone: 'commander' },
      ...found.cards.map(([name, quantity]) => ({ name, quantity, zone: 'main' })),
    ];
    const result = await withTransaction(async (db) => {
      const { rows } = await db.query(
        "INSERT INTO decks (user_id, name, format, notes) VALUES ($1, $2, 'commander', $3) RETURNING id",
        [req.user.id, req.body.name || cmd.name, 'Créé depuis le deck moyen EDHREC'],
      );
      return { id: rows[0].id, unknown: await addCardsByName(db, req.user.id, rows[0].id, entries) };
    });
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
});

export default router;
