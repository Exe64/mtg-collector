import { query, pool } from '../config/db.js';
import * as scryfall from './scryfall.js';
import { mapScryfallCard, upsertCard, ensureCard } from './cards.js';
import { logChanges } from './collectionLog.js';
import { realSet } from './sets.js';

const CONDITION_MAP = {
  M: 'MT', MT: 'MT', MINT: 'MT',
  NM: 'NM', 'NEAR MINT': 'NM',
  EX: 'EX', EXCELLENT: 'EX',
  GD: 'GD', GOOD: 'GD',
  SP: 'LP', LP: 'LP', 'LIGHT PLAYED': 'LP', 'LIGHTLY PLAYED': 'LP',
  MP: 'PL', PL: 'PL', PLAYED: 'PL', 'MODERATELY PLAYED': 'PL',
  HP: 'PO', PO: 'PO', POOR: 'PO', D: 'PO', DMG: 'PO', DAMAGED: 'PO', 'HEAVILY PLAYED': 'PO',
};
const LANG_MAP = {
  ENGLISH: 'en', FRENCH: 'fr', GERMAN: 'de', ITALIAN: 'it', SPANISH: 'es', PORTUGUESE: 'pt',
  JAPANESE: 'ja', KOREAN: 'ko', RUSSIAN: 'ru', 'CHINESE SIMPLIFIED': 'zhs', 'CHINESE TRADITIONAL': 'zht',
};
const VALID_CONDITIONS = ['MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO'];

// Lecteur insensible à la casse des en-têtes CSV.
function pick(row, ...keys) {
  for (const k of keys) {
    for (const rk of Object.keys(row)) {
      if (rk.toLowerCase() === k.toLowerCase() && row[rk] !== '' && row[rk] != null) return row[rk];
    }
  }
  return undefined;
}

export function normalizeRow(row) {
  const quantity = parseInt(pick(row, 'Count', 'Quantity', 'quantity', 'qty') || '', 10);
  const name = String(pick(row, 'Name', 'name') || '').trim();
  const setRaw = String(pick(row, 'Edition', 'Set', 'Set code', 'set', 'set_code') || '').trim();
  // « Foreign White Border » (Cardmarket) → Revised côté Scryfall ; la langue de la ligne est conservée
  const set = realSet(/^foreign white border$/i.test(setRaw) ? 'fwb' : setRaw);
  const collector = String(pick(row, 'Collector Number', 'collector_number') || '').trim();
  // Résolution exacte si un identifiant Scryfall est présent (export ManaBox, etc.)
  const scryfallId = String(pick(row, 'Scryfall ID', 'scryfall_id', 'scryfallId') || '').trim();

  // Underscores ManaBox (near_mint, light_played…) → espaces, puis mapping commun
  const condRaw = String(pick(row, 'Condition', 'condition') || '').trim().toUpperCase().replace(/_/g, ' ');
  const condition = CONDITION_MAP[condRaw] || (VALID_CONDITIONS.includes(condRaw) ? condRaw : 'NM');

  const langRaw = String(pick(row, 'Language', 'language', 'lang') || '').trim();
  const language = LANG_MAP[langRaw.toUpperCase()]
    || (langRaw && langRaw.length <= 3 ? langRaw.toLowerCase() : 'en');

  const foilRaw = String(pick(row, 'Foil', 'foil', 'finish') || '').trim().toLowerCase();
  const finish = foilRaw === 'foil' ? 'foil' : foilRaw === 'etched' ? 'etched' : 'nonfoil';

  const priceRaw = pick(row, 'Purchase Price', 'purchase_price', 'acquired_price');
  const price = priceRaw != null ? parseFloat(String(priceRaw).replace(',', '.')) : NaN;

  return {
    quantity: Number.isFinite(quantity) ? quantity : NaN,
    name, set, collector_number: collector, scryfall_id: scryfallId, condition, language, finish,
    acquired_price: Number.isFinite(price) ? price : null,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Résolution DB locale uniquement (Scryfall ID, set+n°, nom+set, nom). Null si absent. */
async function resolveLocal(p) {
  if (p.scryfall_id && UUID_RE.test(p.scryfall_id)) {
    const r = await query('SELECT id FROM cards WHERE scryfall_id = $1 LIMIT 1', [p.scryfall_id]);
    if (r.rows[0]) return r.rows[0];
  }
  if (p.set && p.collector_number) {
    const r = await query(
      'SELECT id FROM cards WHERE lower(set_code) = lower($1) AND collector_number = $2 LIMIT 1',
      [p.set, p.collector_number],
    );
    if (r.rows[0]) return r.rows[0];
  }
  if (p.set) {
    const r = await query(
      'SELECT id FROM cards WHERE lower(name) = lower($1) AND lower(set_code) = lower($2) LIMIT 1',
      [p.name, p.set],
    );
    if (r.rows[0]) return r.rows[0];
  }
  const byName = await query(
    'SELECT id FROM cards WHERE lower(name) = lower($1) ORDER BY updated_at DESC LIMIT 1',
    [p.name],
  );
  return byName.rows[0] || null;
}

/**
 * Résolution locale groupée (une requête par clé) : Scryfall ID, puis set + n°.
 * `parsed` : lignes normalisées (null = ligne invalide). Renvoie Map(index → { id }) ;
 * les lignes absentes retombent sur resolveLocal / resolveCard (nom, Scryfall).
 */
async function resolveLocalBatch(parsed) {
  const found = new Map();
  const ids = [...new Set(parsed.filter((p) => p && UUID_RE.test(p.scryfall_id)).map((p) => p.scryfall_id.toLowerCase()))];
  if (ids.length) {
    const { rows } = await query('SELECT id, scryfall_id FROM cards WHERE scryfall_id = ANY($1::uuid[])', [ids]);
    const byId = new Map(rows.map((r) => [r.scryfall_id, r.id]));
    parsed.forEach((p, i) => {
      const id = p?.scryfall_id && byId.get(p.scryfall_id.toLowerCase());
      if (id) found.set(i, { id });
    });
  }
  const pending = parsed.flatMap((p, i) => (p && !found.has(i) && p.set && p.collector_number ? [[p, i]] : []));
  if (pending.length) {
    const { rows } = await query(
      `SELECT DISTINCT ON (k.s, k.n) c.id, k.s, k.n
       FROM unnest($1::text[], $2::text[]) AS k(s, n)
       JOIN cards c ON lower(c.set_code) = k.s AND c.collector_number = k.n`,
      [pending.map(([p]) => p.set.toLowerCase()), pending.map(([p]) => p.collector_number)],
    );
    const byKey = new Map(rows.map((r) => [`${r.s}|${r.n}`, r.id]));
    for (const [p, i] of pending) {
      const id = byKey.get(`${p.set.toLowerCase()}|${p.collector_number}`);
      if (id) found.set(i, { id });
    }
  }
  return found;
}

const isValid = (p) => p.name && Number.isFinite(p.quantity) && p.quantity >= 1;

/** Résout une carte : DB locale d'abord, Scryfall en secours (upsert). */
async function resolveCard(p) {
  const local = await resolveLocal(p);
  if (local) return local;

  if (p.scryfall_id && UUID_RE.test(p.scryfall_id)) {
    const card = await ensureCard(p.scryfall_id);
    if (card) return card;
  }
  let raw = null;
  if (p.set && p.collector_number) raw = await scryfall.getCardBySetNumber(p.set, p.collector_number);
  if (!raw) {
    const q = p.set ? `!"${p.name}" set:${p.set}` : `!"${p.name}"`;
    const s = await scryfall.searchCards(q, 1);
    raw = s?.data?.[0] || null;
  }
  if (!raw) return null;
  return upsertCard(mapScryfallCard(raw));
}

/** Aperçu sans insertion : compte résolu localement / nécessite Scryfall / invalide. */
export async function dryRunImport(rows) {
  let resolvedLocally = 0;
  let needsScryfall = 0;
  let invalid = 0;
  const samples = { needsScryfall: [], invalid: [] };
  const parsed = rows.map((r) => {
    const p = normalizeRow(r);
    return isValid(p) ? p : null;
  });
  const pre = await resolveLocalBatch(parsed);

  for (let i = 0; i < rows.length; i += 1) {
    const line = i + 2;
    const p = parsed[i] || normalizeRow(rows[i]);
    if (!parsed[i]) {
      invalid += 1;
      if (samples.invalid.length < 20) samples.invalid.push({ line, name: p.name || '?' });
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const local = pre.get(i) || await resolveLocal(p);
    if (local) {
      resolvedLocally += 1;
    } else {
      needsScryfall += 1;
      if (samples.needsScryfall.length < 20) samples.needsScryfall.push({ line, name: p.name });
    }
  }
  return { total: rows.length, resolvedLocally, needsScryfall, invalid, samples };
}

export async function importCsv(userId, rows, mode = 'merge', location = '') {
  // Phase 1 — résolution (appels Scryfall) HORS transaction : on ne touche pas
  // encore à la collection, donc un échec ici la laisse intacte.
  const resolved = [];
  const errors = [];
  const parsed = rows.map((r) => {
    try {
      const p = normalizeRow(r);
      return isValid(p) ? p : null;
    } catch {
      return null;
    }
  });
  const pre = await resolveLocalBatch(parsed);
  for (let i = 0; i < rows.length; i += 1) {
    const line = i + 2; // +1 en-tête, +1 base 1
    try {
      const p = parsed[i] || normalizeRow(rows[i]);
      if (!parsed[i]) {
        errors.push({ line, name: p.name || '?', error: 'nom ou quantité manquant/invalide' });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const card = pre.get(i) || await resolveCard(p);
      if (!card) {
        errors.push({ line, name: p.name, error: 'carte introuvable' });
        continue;
      }
      resolved.push({ cardId: card.id, p });
    } catch (err) {
      errors.push({ line, error: err.message });
    }
  }

  // Phase 2 — application ATOMIQUE (DELETE éventuel + inserts) dans une transaction
  // sur un client dédié : un crash en cours = ROLLBACK, la collection reste intacte.
  const client = await pool.connect();
  let imported = 0;
  try {
    await client.query('BEGIN');
    if (mode === 'replace') {
      // Trace le retrait de l'existant (agrégé par carte/finition) avant le DELETE
      await client.query(
        `INSERT INTO collection_log (user_id, card_id, quantity_delta, finish, source)
         SELECT user_id, card_id, -SUM(quantity)::int, finish, 'import'
         FROM collection_entries WHERE user_id = $1
         GROUP BY user_id, card_id, finish`,
        [userId],
      );
      await client.query('DELETE FROM collection_entries WHERE user_id = $1', [userId]);
    }
    for (const { cardId, p } of resolved) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO collection_entries
           (user_id, card_id, quantity, finish, condition, language, location, acquired_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, card_id, finish, condition, language, location)
         DO UPDATE SET quantity = collection_entries.quantity + EXCLUDED.quantity`,
        [userId, cardId, p.quantity, p.finish, p.condition, p.language, location, p.acquired_price],
      );
      imported += 1;
    }
    // Journal des ajouts, agrégé par carte/finition pour limiter le volume
    const added = new Map();
    for (const { cardId, p } of resolved) {
      const key = `${cardId}|${p.finish}`;
      added.set(key, (added.get(key) || 0) + p.quantity);
    }
    await logChanges(
      userId,
      [...added].map(([key, delta]) => {
        const [cardId, finish] = key.split('|');
        return { cardId: Number(cardId), delta, finish };
      }),
      'import',
      client,
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { imported, skipped: errors.length, errors };
}
