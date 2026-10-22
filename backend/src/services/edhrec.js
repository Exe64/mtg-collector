import PQueue from 'p-queue';

import { query } from '../config/db.js';
import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { getCatalog, CATALOG_KEY, RANKS_KEY } from './commanders.js';

const UA = process.env.SCRYFALL_USER_AGENT || 'MagicCollectionManager/1.0';
const TTL_MS = 7 * 24 * 3600 * 1000;

// API non officielles : une requête à la fois, ~1 par seconde, tous appels confondus.
const queue = new PQueue({ interval: 1100, intervalCap: 1, concurrency: 1 });

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw Object.assign(new Error(`${new URL(url).host} a répondu ${res.status}`), { status: 502 });
  return res.json();
}

/** Slug EDHREC d'un nom de carte : face avant, sans accents ni apostrophes, tirets. */
export function edhrecSlug(name) {
  return String(name).split(' // ')[0]
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function readRow(key) {
  const { rows } = await query('SELECT data, fetched_at FROM external_cache WHERE key = $1', [key]);
  return rows[0] || null;
}

const isFresh = (row) => row && Date.now() - new Date(row.fetched_at).getTime() < TTL_MS;

/**
 * Lecture à travers le cache : frais → base ; absent ou périmé → appel externe
 * (file limitée), puis écriture. Si l'appel échoue, on sert la copie périmée.
 */
async function throughCache(key, fetcher, { cacheOnly = false } = {}) {
  const row = await readRow(key);
  if (isFresh(row) || (cacheOnly && row)) return row.data;
  if (cacheOnly) return undefined;
  try {
    const data = await queue.add(fetcher);
    await query(
      `INSERT INTO external_cache (key, data, fetched_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, fetched_at = now()`,
      [key, data === null ? null : JSON.stringify(data)],
    );
    return data;
  } catch (e) {
    if (row) return row.data;
    throw e;
  }
}

// EDHREC renvoie parfois { redirect: "/commanders/…" } (nom renommé, alias).
async function edhrecPage(path) {
  let data = await getJson(`https://json.edhrec.com/pages/${path}.json`);
  if (data?.redirect) data = await getJson(`https://json.edhrec.com/pages${data.redirect}.json`);
  return data;
}

const cardLists = (d) => d?.container?.json_dict?.cardlists || [];

/** Page commandant EDHREC réduite : rang, thèmes, cartes principales, similaires. */
export function commanderPage(name, opts) {
  const slug = edhrecSlug(name);
  return throughCache(`edhrec:commander:${slug}`, async () => {
    const d = await edhrecPage(`commanders/${slug}`);
    if (!d) return null;
    const card = d.container?.json_dict?.card || {};
    const lists = cardLists(d);
    const pick = (tag, n) => (lists.find((l) => l.tag === tag)?.cardviews || []).slice(0, n)
      .map((c) => ({ name: c.name, numDecks: c.num_decks ?? null, synergy: c.synergy ?? null }));
    return {
      slug,
      rank: card.rank ?? null,
      numDecks: card.num_decks ?? null,
      salt: card.salt ?? null,
      themes: (d.panels?.taglinks || []).slice(0, 12)
        .map((t) => ({ slug: t.slug, name: t.value, count: t.count })),
      topCards: pick('topcards', 10),
      synergyCards: pick('highsynergycards', 10),
      similar: (d.similar || []).slice(0, 8),
    };
  }, opts);
}

/** Deck moyen EDHREC : [[nom, qté]] hors commandant. */
export function averageDeck(name, opts) {
  const slug = edhrecSlug(name);
  return throughCache(`edhrec:average:${slug}`, async () => {
    const d = await edhrecPage(`average-decks/${slug}`);
    if (!d?.deck?.cards) return null;
    return Object.values(d.deck.cards).flat().map(([n, q]) => [n, q]);
  }, opts);
}

export const BRACKETS = ['exhibition', 'core', 'upgraded', 'optimized', 'cedh'];
export const BUDGETS = ['budget', 'expensive'];

/**
 * Variante du deck moyen : niveau de puissance, thème et tranche de prix,
 * combinables (chemin EDHREC `average-decks/<slug>[/<niveau>][/<thème>][/<prix>]`).
 * → { cards: [[nom, qté]], numDecks } ou null si EDHREC n'a pas cette combinaison.
 */
export function averageDeckVariant(name, { theme, bracket, budget } = {}, opts) {
  const slug = edhrecSlug(name);
  const path = [slug, bracket, theme, budget].filter(Boolean).join('/');
  return throughCache(`edhrec:average-variant:${path}`, async () => {
    const d = await edhrecPage(`average-decks/${path}`);
    if (!d?.deck?.cards) return null;
    return {
      cards: Object.values(d.deck.cards).flat().map(([n, q]) => [n, q]),
      numDecks: d.container?.json_dict?.card?.num_decks ?? null,
    };
  }, opts);
}

/** Les ~410 thèmes EDHREC par popularité : [{ slug, name, numDecks }]. */
export function themes(opts) {
  return throughCache('edhrec:tags', async () => {
    const d = await edhrecPage('tags');
    return (cardLists(d)[0]?.cardviews || []).map((t) => ({
      slug: String(t.url || '').replace(/^\/tags\//, ''),
      name: t.name,
      numDecks: t.num_decks ?? null,
    })).filter((t) => t.slug);
  }, opts);
}

/** Commandants d'un thème (meilleurs + nouveaux) : [{ name, numDecks }]. */
export function themeCommanders(slug, opts) {
  return throughCache(`edhrec:tag:${slug}`, async () => {
    const d = await edhrecPage(`tags/${slug}`);
    if (!d) return null;
    const lists = cardLists(d);
    const seen = new Set();
    const out = [];
    for (const tag of ['topcommanders', 'newcommanders']) {
      for (const c of lists.find((l) => l.tag === tag)?.cardviews || []) {
        if (seen.has(c.name)) continue;
        seen.add(c.name);
        out.push({ name: c.name, numDecks: c.num_decks ?? null });
      }
    }
    return out;
  }, opts);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Classement des commandants EDHREC (2 dernières années, ~70 pages de 100) :
 * { nom en minuscules: [rang, nb de decks] }. Pages enchaînées à ~1/s dans un
 * seul passage de file ; les paires de partenaires (« A // B ») restent sans effet.
 */
export function commanderRanks(opts) {
  return throughCache(RANKS_KEY, async () => {
    const ranks = {};
    let path = 'commanders/year';
    for (let page = 0; path && page < 150; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      if (page) await sleep(1100);
      // eslint-disable-next-line no-await-in-loop
      const d = await edhrecPage(path);
      const views = page ? d?.cardviews : cardLists(d)[0]?.cardviews;
      for (const c of views || []) {
        const k = c.name.toLowerCase();
        if (!ranks[k]) ranks[k] = [c.rank ?? Object.keys(ranks).length + 1, c.num_decks ?? null];
      }
      path = (page ? d?.more : cardLists(d)[0]?.more)?.replace(/\.json$/, '') || null;
    }
    if (!Object.keys(ranks).length) throw new Error('classement EDHREC vide');
    return ranks;
  }, opts);
}

/** Combos Commander Spellbook utilisant la carte, les plus populaires d'abord. */
export function combos(name, opts) {
  return throughCache(`spellbook:combos:${name.toLowerCase()}`, async () => {
    const q = new URLSearchParams({
      q: `card="${name}" legal:commander`, ordering: '-popularity', limit: '20',
    });
    const d = await getJson(`https://backend.commanderspellbook.com/variants/?${q}`);
    return (d?.results || []).map((v) => ({
      id: v.id,
      uses: v.uses.map((u) => ({ name: u.card.name, oracleId: u.card.oracleId })),
      produces: v.produces.map((p) => p.feature.name),
      popularity: v.popularity ?? null,
      bracket: v.bracketTag ?? null,
    }));
  }, opts);
}

/**
 * Job de fond : pages EDHREC + deck moyen des commandants possédés (tous comptes),
 * puis thèmes. Seules les entrées absentes ou périmées partent en requête.
 */
export async function refreshCommanderCache() {
  const before = await readRow(RANKS_KEY);
  if (!isFresh(before)) {
    await commanderRanks().catch((e) => logger.warn({ err: e.message }, 'cache commandants : classement EDHREC indisponible'));
    await redis.del(CATALOG_KEY);
  }
  const catalog = await getCatalog();
  const { rows } = await query(
    `SELECT DISTINCT c.oracle_id
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE c.oracle_id IS NOT NULL AND c.type_line ILIKE 'Legendary%'`,
  );
  const owned = new Set(rows.map((r) => r.oracle_id));
  const names = catalog.filter((c) => owned.has(c.oracle_id) && c.pairing !== 'background').map((c) => c.name);

  let failed = 0;
  const safe = (p) => p.catch((e) => { failed += 1; logger.warn({ err: e.message }, 'cache commandants : appel ignoré'); });
  for (const name of names) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all([safe(commanderPage(name)), safe(averageDeck(name))]);
  }
  const tags = (await safe(themes())) || [];
  for (const t of tags) {
    // eslint-disable-next-line no-await-in-loop
    await safe(themeCommanders(t.slug));
  }
  logger.info(`cache commandants : ${names.length} commandant(s), ${tags.length} thème(s), ${failed} échec(s)`);
  return { commanders: names.length, themes: tags.length, failed };
}
