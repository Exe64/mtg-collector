import { query } from '../config/db.js';
import * as scryfall from './scryfall.js';

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

// Colonnes upsertées (ordre = ordre des paramètres). updated_at est ajouté à part.
const CARD_COLUMNS = [
  'scryfall_id', 'oracle_id', 'name', 'set_code', 'set_name', 'collector_number',
  'image_uri', 'image_uri_small', 'card_faces', 'colors', 'color_identity',
  'type_line', 'oracle_text', 'mana_cost', 'rarity', 'finishes',
  'prices_eur', 'prices_eur_foil', 'prices_eur_etched',
  'prices_usd', 'prices_usd_foil', 'prices_raw',
];
const JSONB_COLS = new Set(['card_faces', 'prices_raw']);

/** Normalise une carte Scryfall (brute) vers le schéma `cards`. */
export function mapScryfallCard(c) {
  const face0 = c.card_faces?.[0] || {};
  const img = c.image_uris || face0.image_uris || {};
  const prices = c.prices || {};
  return {
    scryfall_id: c.id,
    oracle_id: c.oracle_id || face0.oracle_id || null,
    name: c.name,
    set_code: c.set,
    set_name: c.set_name,
    collector_number: c.collector_number,
    image_uri: img.normal || img.large || null,
    image_uri_small: img.small || null,
    card_faces: c.card_faces ? JSON.stringify(c.card_faces) : null,
    colors: c.colors || face0.colors || null,
    color_identity: c.color_identity || null,
    type_line: c.type_line || c.card_faces?.map((f) => f.type_line).join(' // ') || null,
    oracle_text: c.oracle_text ?? face0.oracle_text ?? null,
    mana_cost: c.mana_cost ?? face0.mana_cost ?? null,
    rarity: c.rarity || null,
    finishes: c.finishes || null,
    prices_eur: num(prices.eur),
    prices_eur_foil: num(prices.eur_foil),
    prices_eur_etched: num(prices.eur_etched),
    prices_usd: num(prices.usd),
    prices_usd_foil: num(prices.usd_foil),
    prices_raw: JSON.stringify(prices),
  };
}

const UPDATE_SET = CARD_COLUMNS
  .filter((c) => c !== 'scryfall_id')
  .map((c) => `${c} = EXCLUDED.${c}`)
  .concat('updated_at = NOW()')
  .join(', ');

/** Upsert d'une carte (lazy upsert) — crée un stub `sets` pour satisfaire la FK. */
export async function upsertCard(card) {
  if (card.set_code) {
    await query(
      'INSERT INTO sets (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING',
      [card.set_code, card.set_name || card.set_code],
    );
  }
  const placeholders = CARD_COLUMNS.map(
    (c, i) => `$${i + 1}${JSONB_COLS.has(c) ? '::jsonb' : ''}`,
  );
  const params = CARD_COLUMNS.map((c) => card[c] ?? null);
  const { rows } = await query(
    `INSERT INTO cards (${CARD_COLUMNS.join(', ')}, updated_at)
     VALUES (${placeholders.join(', ')}, NOW())
     ON CONFLICT (scryfall_id) DO UPDATE SET ${UPDATE_SET}
     RETURNING *`,
    params,
  );
  return rows[0];
}

/** Upsert en lot (bulk-data) — un seul INSERT multi-lignes. Suppose les sets déjà présents. */
export async function upsertCardsBatch(cards) {
  if (!cards.length) return 0;
  const params = [];
  const rowsSql = cards.map((card) => {
    const ph = CARD_COLUMNS.map((c) => {
      params.push(card[c] ?? null);
      return `$${params.length}${JSONB_COLS.has(c) ? '::jsonb' : ''}`;
    });
    return `(${ph.join(', ')}, NOW())`;
  });
  await query(
    `INSERT INTO cards (${CARD_COLUMNS.join(', ')}, updated_at)
     VALUES ${rowsSql.join(', ')}
     ON CONFLICT (scryfall_id) DO UPDATE SET ${UPDATE_SET}`,
    params,
  );
  return cards.length;
}

/**
 * Lazy upsert : renvoie la carte locale, en la récupérant depuis Scryfall si absente.
 * Primitive utilisée à l'ajout en collection (Sprint 3).
 */
export async function ensureCard(scryfallId) {
  const { rows } = await query('SELECT * FROM cards WHERE scryfall_id = $1', [scryfallId]);
  if (rows[0]) return rows[0];
  const raw = await scryfall.getCard(scryfallId);
  if (!raw) return null;
  return upsertCard(mapScryfallCard(raw));
}

// --- Mappers vers la forme client (unifiée pour Scryfall brut ET ligne DB) ---

export function toClientCard(raw) {
  const img = raw.image_uris || raw.card_faces?.[0]?.image_uris || {};
  const p = raw.prices || {};
  return {
    scryfall_id: raw.id,
    name: raw.name,
    set: raw.set,
    set_name: raw.set_name,
    collector_number: raw.collector_number,
    rarity: raw.rarity,
    image: img.normal || img.large || null,
    image_small: img.small || null,
    finishes: raw.finishes || [],
    prices: {
      eur: num(p.eur), eur_foil: num(p.eur_foil), eur_etched: num(p.eur_etched),
      usd: num(p.usd), usd_foil: num(p.usd_foil),
    },
  };
}

export function dbCardToClient(row) {
  return {
    scryfall_id: row.scryfall_id,
    name: row.name,
    set: row.set_code,
    set_name: row.set_name,
    collector_number: row.collector_number,
    rarity: row.rarity,
    image: row.image_uri,
    image_small: row.image_uri_small,
    type_line: row.type_line,
    oracle_text: row.oracle_text,
    mana_cost: row.mana_cost,
    card_faces: row.card_faces,
    colors: row.colors,
    finishes: row.finishes || [],
    prices: {
      eur: row.prices_eur, eur_foil: row.prices_eur_foil, eur_etched: row.prices_eur_etched,
      usd: row.prices_usd, usd_foil: row.prices_usd_foil,
    },
  };
}
