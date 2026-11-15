import { query } from '../config/db.js';
import { cached } from './cache.js';
import { BASIC_LANDS, PLAYABLE, frontKey } from './deckCheck.js';

export const CATALOG_KEY = 'cmd:catalog';
export const RANKS_KEY = 'edhrec:commander-ranks';

// Carte réversible (« X // X ») : un seul nom, une seule ligne de type.
const dedupeFaces = (s) => {
  const parts = String(s || '').split(' // ');
  return parts.length === 2 && parts[0] === parts[1] ? parts[0] : s;
};

/**
 * Appariement d'un commandant, déduit des mots-clés Scryfall avec repli sur le
 * texte oracle (cartes pas encore resynchronisées). `background` : un Historique,
 * qui ne peut pas mener seul.
 */
export function pairingOf({ type_line: typeLine, oracle_text: text, keywords }) {
  const kw = new Set((keywords || []).map((k) => k.toLowerCase()));
  const t = text || '';
  const front = String(typeLine || '').split(' // ')[0];
  if (/\bBackground\b/.test(front)) return 'background';
  if (kw.has('partner with') || /^Partner with /m.test(t)) return 'partner_with';
  if (kw.has('friends forever') || /^Friends forever\b/m.test(t)) return 'friends_forever';
  if (kw.has('choose a background') || /^Choose a Background\b/im.test(t)) return 'choose_background';
  if (kw.has("doctor's companion") || /^Doctor's companion\b/m.test(t)) return 'doctors_companion';
  if (/\bTime Lord Doctor\b/.test(front)) return 'doctor';
  if (kw.has('partner') || /^Partner\b/m.test(t)) return 'partner';
  return null;
}

// Commandants légaux, une ligne par oracle_id : impression la moins chère en €
// (image et prix), rang EDHREC et première sortie sur toutes les impressions.
// Éligible : légende créature ou Historique (face avant), ou « peut être votre commandant ».
// Popularité : classement des commandants EDHREC (2 ans, mis en cache par le job de
// fond) ; à défaut, rang Scryfall `edhrec_rank`, qui mesure la carte dans les 99.
async function loadCatalog() {
  const { rows: rankRows } = await query('SELECT data FROM external_cache WHERE key = $1', [RANKS_KEY]);
  const ranks = rankRows[0]?.data || null;
  const { rows } = await query(
    `SELECT * FROM (
       SELECT DISTINCT ON (c.oracle_id)
              c.oracle_id, c.scryfall_id, c.name, c.name_fr, c.type_line, c.oracle_text,
              c.mana_cost, c.cmc, c.color_identity, c.keywords, c.game_changer, c.image_uri,
              COALESCE(c.prices_eur, c.prices_eur_foil) AS eur,
              MIN(c.edhrec_rank) OVER w AS edhrec_rank,
              MIN(s.released_at) OVER w AS released_at
       FROM cards c LEFT JOIN sets s ON s.code = c.set_code
       WHERE c.legal_commander AND c.oracle_id IS NOT NULL
         AND (split_part(c.type_line, ' // ', 1) ~ '^Legendary.*\\m(Creature|Background)\\M'
              OR c.oracle_text ILIKE '%can be your commander%')
       WINDOW w AS (PARTITION BY c.oracle_id)
       ORDER BY c.oracle_id, COALESCE(c.prices_eur, c.prices_eur_foil) ASC NULLS LAST, s.released_at DESC
     ) t`,
  );
  const list = rows.map(({ keywords, edhrec_rank: cardRank, ...r }) => {
    const name = dedupeFaces(r.name);
    const hit = ranks?.[name.toLowerCase()];
    return {
      ...r,
      name,
      type_line: dedupeFaces(r.type_line),
      cmc: r.cmc === null ? null : Number(r.cmc),
      eur: r.eur === null ? null : Number(r.eur),
      color_identity: r.color_identity || [],
      pairing: pairingOf({ ...r, keywords }),
      rank: ranks ? hit?.[0] ?? null : cardRank,
      num_decks: hit?.[1] ?? null,
    };
  });
  return list.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.name.localeCompare(b.name));
}

/** Catalogue commun à tous les comptes (cache Redis, vidé au sync bulk). */
export function getCatalog() {
  return cached(CATALOG_KEY, 6 * 3600, loadCatalog);
}

/** oracle_id des légendes possédées par le compte. */
export async function ownedLegendOracles(userId) {
  const { rows } = await query(
    `SELECT DISTINCT c.oracle_id
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE e.user_id = $1 AND c.oracle_id IS NOT NULL AND c.type_line ILIKE 'Legendary%'`,
    [userId],
  );
  return rows.map((r) => r.oracle_id);
}

/**
 * Cartes possédées par le compte, par nom (face avant, minuscules), toutes éditions
 * confondues → impression la plus détenue (pour ouvrir la carte sur son propre exemplaire).
 * Les cartes « Art Series » (même nom, type « Card ») ne valent pas la carte jouable.
 */
export async function ownedFrontNames(userId) {
  const { rows } = await query(
    `SELECT DISTINCT ON (lower(split_part(c.name, ' // ', 1)))
            lower(split_part(c.name, ' // ', 1)) AS k, c.scryfall_id, c.image_uri_small
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE e.user_id = $1 AND ${PLAYABLE}
     ORDER BY lower(split_part(c.name, ' // ', 1)), e.quantity DESC`,
    [userId],
  );
  return new Map(rows.map((r) => [r.k, r]));
}

/**
 * Impression la moins chère par nom (face avant) : prix, scryfall_id, petite image, type.
 * Impressions jouables d'abord : les cartes « Art Series » (type « Card ») portent le même nom.
 */
export async function cardsByFront(names) {
  const keys = [...new Set(names.map(frontKey))];
  if (!keys.length) return new Map();
  const { rows } = await query(
    `SELECT DISTINCT ON (lower(split_part(name, ' // ', 1)))
            lower(split_part(name, ' // ', 1)) AS k, scryfall_id, image_uri_small, type_line,
            COALESCE(prices_eur, prices_eur_foil) AS eur
     FROM cards
     WHERE lower(split_part(name, ' // ', 1)) = ANY($1::text[])
     ORDER BY lower(split_part(name, ' // ', 1)), legal_commander DESC, COALESCE(prices_eur, prices_eur_foil) ASC NULLS LAST`,
    [keys],
  );
  return new Map(rows.map((r) => [r.k, { ...r, eur: r.eur === null ? null : Number(r.eur) }]));
}

/**
 * Couverture d'un deck ([[nom, qté]]) par la collection, même clé de comparaison
 * que `checkDeck` (face avant, toutes versions). Terrains de base exclus.
 */
export function coverage(deck, ownedNames, byFront) {
  let total = 0;
  let owned = 0;
  const missing = [];
  for (const [name, qty] of deck) {
    const k = frontKey(name);
    if (BASIC_LANDS.has(k)) continue;
    total += 1;
    if (ownedNames.has(k)) owned += 1;
    else missing.push({ name, qty, eur: byFront?.get(k)?.eur ?? null });
  }
  const missingEur = missing.reduce((s, m) => s + (m.eur || 0) * m.qty, 0);
  return {
    total,
    owned,
    pct: total ? Math.round((100 * owned) / total) : 0,
    missing,
    missingEur: Number(missingEur.toFixed(2)),
  };
}

/**
 * Ajoute en wishlist l'impression la moins chère de chaque nom (face avant), sauf les
 * noms déjà en wishlist quelle que soit l'impression. → nombre de cartes ajoutées.
 */
export async function namesToWishlist(userId, names, note) {
  const keys = [...new Set(names.map(frontKey))];
  if (!keys.length) return 0;
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
    [userId, keys, note],
  );
  return rowCount;
}
