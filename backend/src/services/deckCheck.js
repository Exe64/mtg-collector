import { query } from '../config/db.js';
import { cached } from './cache.js';

const MOXFIELD_UA = 'MTGCollectionManager/1.0 (deck check)';

const BASIC_LANDS = new Set([
  'plains', 'island', 'swamp', 'mountain', 'forest', 'wastes',
  'snow-covered plains', 'snow-covered island', 'snow-covered swamp',
  'snow-covered mountain', 'snow-covered forest',
]);

// Clé de comparaison : face avant uniquement, minuscules, trim.
// (« Fire // Ice » et « Fire » matchent ; toutes versions confondues.)
function frontKey(name) {
  return String(name).split('//')[0].trim().toLowerCase();
}

// Parse une liste texte (Moxfield collé ou MTGO .txt) → [{ name, quantity }]
export function parseDeckText(text) {
  const out = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;
    // En-têtes de section sans quantité (Sideboard, Commander, Deck…)
    if (!/^\d/.test(line) && /^(sideboard|commander|companion|deck|maybeboard|tokens?)\b/i.test(line)) continue;
    const m = line.match(/^(\d+)\s*[xX]?\s+(.+)$/);
    if (!m) continue;
    const quantity = parseInt(m[1], 10);
    let name = m[2].trim();
    name = name.replace(/\s+\([0-9A-Za-z]{2,6}\)(?:\s.*)?$/, '').trim(); // (SET) collector…
    name = name.replace(/\s*\*[A-Za-z]\*\s*$/, '').trim();              // *F* / *E*
    if (name && Number.isFinite(quantity) && quantity > 0) out.push({ name, quantity });
  }
  return out;
}

function moxfieldId(url) {
  const m = String(url).match(/decks\/(?:all\/)?([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// Récupère la liste d'un deck Moxfield public → [{ name, quantity }]
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

  const list = [];
  const pushBoard = (cardsObj) => {
    if (!cardsObj) return;
    for (const entry of Object.values(cardsObj)) {
      const name = entry?.card?.name || entry?.name;
      const quantity = entry?.quantity;
      if (name && quantity) list.push({ name, quantity });
    }
  };
  // v3 : data.boards.<board>.cards  ;  v2 : data.<board> directement
  const boards = ['mainboard', 'sideboard', 'commanders', 'companions'];
  for (const key of boards) {
    pushBoard(data.boards ? data.boards[key]?.cards : data[key]);
  }
  return list;
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

  // Possédé par nom, toutes versions confondues
  const { rows } = await query(
    `SELECT c.name, SUM(e.quantity)::int AS qty
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE e.user_id = $1
     GROUP BY c.name`,
    [userId],
  );
  const owned = new Map();
  for (const r of rows) {
    const k = frontKey(r.name);
    owned.set(k, (owned.get(k) || 0) + r.qty);
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
