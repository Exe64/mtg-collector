import { query } from '../config/db.js';
import * as scryfall from './scryfall.js';
import { mapScryfallCard, upsertCard, ensureCard } from './cards.js';

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
  const set = String(pick(row, 'Edition', 'Set', 'Set code', 'set', 'set_code') || '').trim();
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

/** Résout une carte : Scryfall ID exact d'abord, puis DB locale (set+n°, nom+set, nom), Scryfall en secours. */
async function resolveCard(p) {
  if (p.scryfall_id && UUID_RE.test(p.scryfall_id)) {
    const card = await ensureCard(p.scryfall_id); // DB-first, Scryfall si absent
    if (card) return card;
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
  if (byName.rows[0]) return byName.rows[0];

  // Secours Scryfall
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

export async function importCsv(userId, rows, mode = 'merge', location = '') {
  if (mode === 'replace') {
    await query('DELETE FROM collection_entries WHERE user_id = $1', [userId]);
  }

  let imported = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i += 1) {
    const line = i + 2; // +1 en-tête, +1 base 1
    try {
      const p = normalizeRow(rows[i]);
      if (!p.name || !Number.isFinite(p.quantity) || p.quantity < 1) {
        errors.push({ line, name: p.name || '?', error: 'nom ou quantité manquant/invalide' });
        continue;
      }
      const card = await resolveCard(p);
      if (!card) {
        errors.push({ line, name: p.name, error: 'carte introuvable' });
        continue;
      }
      await query(
        `INSERT INTO collection_entries
           (user_id, card_id, quantity, finish, condition, language, location, acquired_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, card_id, finish, condition, language, location)
         DO UPDATE SET quantity = collection_entries.quantity + EXCLUDED.quantity`,
        [userId, card.id, p.quantity, p.finish, p.condition, p.language, location, p.acquired_price],
      );
      imported += 1;
    } catch (err) {
      errors.push({ line, error: err.message });
    }
  }

  return { imported, skipped: errors.length, errors };
}
