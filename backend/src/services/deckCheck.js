import { query } from '../config/db.js';
import { cached } from './cache.js';

const MOXFIELD_UA = 'MTGCollectionManager/1.0 (deck check)';

export const BASIC_LANDS = new Set([
  'plains', 'island', 'swamp', 'mountain', 'forest', 'wastes',
  'snow-covered plains', 'snow-covered island', 'snow-covered swamp',
  'snow-covered mountain', 'snow-covered forest',
]);

// Filtre SQL (alias `c` = cards) : exclut les cartes « Art Series », homonymes de la
// carte jouable (« Sol Ring // Sol Ring », type « Card // Card ») mais qui n'en sont pas un exemplaire.
export const PLAYABLE = "COALESCE(c.type_line, '') NOT LIKE 'Card%'";

// Face avant d'un nom : « Fire // Ice » (Scryfall, Moxfield) ou « Fire / Ice » (autres exports).
export function frontName(name) {
  return String(name).split(/\s*\/\/\s*|\s+\/\s+/)[0].trim();
}

// Clé de comparaison : face avant uniquement, minuscules.
// (« Fire // Ice », « Fire / Ice » et « Fire » matchent ; toutes versions confondues.)
export function frontKey(name) {
  return frontName(name).toLowerCase();
}

// En-têtes de section (Moxfield, MTGO, Arena) → zone du deck ; `null` = section ignorée.
const SECTIONS = [
  [/^(commanders?)\b/i, 'commander'],
  [/^(sideboard|companions?)\b/i, 'side'],
  [/^(maybeboard|considering)\b/i, 'maybe'],
  [/^(deck|main(board)?)\b/i, 'main'],
  [/^(tokens?)\b/i, null],
];

// Parse une liste texte (Moxfield collé ou MTGO .txt) → [{ name, quantity, zone }]
// Les cartes suivent la zone du dernier en-tête rencontré (principal par défaut).
export function parseDeckText(text) {
  const out = [];
  let zone = 'main';
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    // En-tête : « Sideboard », « SIDEBOARD: », « // Commander »…
    const header = line.replace(/^\/\/\s*/, '');
    const section = !/^\d/.test(header) && SECTIONS.find(([re]) => re.test(header));
    if (section) { [, zone] = section; continue; }
    if (line.startsWith('//')) continue;
    const m = line.match(/^(\d+)\s*[xX]?\s+(.+)$/);
    if (!m || zone === null) continue;
    const quantity = parseInt(m[1], 10);
    let name = m[2].trim();
    name = name.replace(/\s+\([0-9A-Za-z]{2,6}\)(?:\s.*)?$/, '').trim(); // (SET) collector…
    name = name.replace(/\s*\*[A-Za-z]\*\s*$/, '').trim();              // *F* / *E*
    if (name && Number.isFinite(quantity) && quantity > 0) out.push({ name, quantity, zone });
  }
  return out;
}

function moxfieldId(url) {
  const m = String(url).match(/decks\/(?:all\/)?([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// Récupère un deck Moxfield public → { name, format, cards: [{ name, quantity, zone }] }
export async function fetchMoxfieldDeck(url) {
  const id = moxfieldId(url);
  if (!id) { const e = new Error('URL Moxfield invalide'); e.status = 400; throw e; }
  const data = await cached(`moxfield:deck:${id}`, 3600, async () => {
    const res = await fetch(`https://api2.moxfield.com/v3/decks/all/${id}`, {
      headers: { 'User-Agent': MOXFIELD_UA, Accept: 'application/json' },
    });
    if (!res.ok) {
      const e = new Error(`Moxfield a répondu ${res.status}. Le deck est-il public ? Sinon, colle la liste.`);
      e.status = 502;
      throw e;
    }
    return res.json();
  });

  const cards = [];
  // v3 : data.boards.<board>.cards  ;  v2 : data.<board> directement
  const boards = {
    commanders: 'commander', mainboard: 'main', sideboard: 'side', companions: 'side', maybeboard: 'maybe',
  };
  for (const [key, zone] of Object.entries(boards)) {
    const board = data.boards ? data.boards[key]?.cards : data[key];
    for (const entry of Object.values(board || {})) {
      const name = entry?.card?.name || entry?.name;
      const quantity = entry?.quantity;
      if (name && quantity) cards.push({ name, quantity, zone });
    }
  }
  return { name: data.name || null, format: data.format || null, cards };
}

// Compare une liste de deck à la collection (par nom de carte, face avant).
export async function checkDeck(userId, deckCards) {
  // Besoins agrégés par nom (somme des quantités, libellé d'affichage conservé)
  const needed = new Map(); // frontKey -> { name, quantity }
  for (const { name, quantity } of deckCards) {
    const k = frontKey(name);
    const cur = needed.get(k);
    if (cur) cur.quantity += quantity;
    else needed.set(k, { name, quantity });
  }

  // Impressions possédées, filtrées sur les noms (face avant) du deck.
  const { rows } = await query(
    `SELECT c.name, c.set_code, c.collector_number, e.finish, SUM(e.quantity)::int AS qty
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE e.user_id = $1 AND ${PLAYABLE}
       AND lower(split_part(c.name, ' // ', 1)) = ANY($2::text[])
     GROUP BY c.name, c.set_code, c.collector_number, e.finish
     ORDER BY c.set_code, c.collector_number`,
    [userId, [...needed.keys()]],
  );
  const owned = new Map();   // frontKey -> total possédé
  const versions = new Map(); // frontKey -> [{ set_code, collector_number, finish, qty }]
  for (const r of rows) {
    const k = frontKey(r.name);
    owned.set(k, (owned.get(k) || 0) + r.qty);
    if (!versions.has(k)) versions.set(k, []);
    versions.get(k).push({
      set_code: r.set_code,
      collector_number: r.collector_number,
      finish: r.finish,
      qty: r.qty,
    });
  }

  const cards = [];
  for (const [k, { name, quantity }] of needed) {
    const have = owned.get(k) || 0;
    cards.push({
      name,
      needed: quantity,
      owned: have,
      missing: Math.max(0, quantity - have),
      basic: BASIC_LANDS.has(k),
      versions: versions.get(k) || [],
    });
  }
  cards.sort((a, b) => (b.missing - a.missing) || a.name.localeCompare(b.name));

  const missingCards = cards.filter((c) => c.missing > 0 && !c.basic);
  return {
    cards,
    summary: {
      distinct: cards.length,
      neededTotal: cards.reduce((s, c) => s + c.needed, 0),
      missingDistinct: missingCards.length,
      missingTotal: missingCards.reduce((s, c) => s + c.missing, 0),
    },
  };
}
