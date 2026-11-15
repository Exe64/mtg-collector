import { query } from '../config/db.js';
import { BASIC_LANDS, PLAYABLE, frontKey, frontName, checkDeck } from './deckCheck.js';
import { ensureCard } from './cards.js';
import * as scryfall from './scryfall.js';
import { cardsByFront } from './commanders.js';
import { DECK_FORMATS as FORMATS, DECK_ZONES as ZONES } from '../validation/schemas.js';
// Zones qui comptent dans le deck (taille, possession, coût) ; le « peut-être » n'y entre pas.
const COUNTED = new Set(['commander', 'main']);
const FRONT = "lower(split_part(c.name, ' // ', 1))";

/**
 * Impression par défaut de chaque nom (face avant) : l'exemplaire le plus détenu,
 * sinon la moins chère (jouable, légale en Commander d'abord pour écarter les
 * versions « Art Series » et surdimensionnées). → Map frontKey -> card id.
 */
export async function resolvePrintings(userId, names, db = { query }) {
  const keys = [...new Set(names.map(frontKey))];
  if (!keys.length) return new Map();
  const { rows } = await db.query(
    `SELECT DISTINCT ON (${FRONT}) ${FRONT} AS k, c.id
     FROM cards c
     LEFT JOIN (SELECT card_id, SUM(quantity) AS q FROM collection_entries WHERE user_id = $1 GROUP BY card_id) o
       ON o.card_id = c.id
     WHERE ${FRONT} = ANY($2::text[]) AND ${PLAYABLE}
     ORDER BY ${FRONT}, o.q DESC NULLS LAST, c.legal_commander DESC,
              COALESCE(c.prices_eur, c.prices_eur_foil) ASC NULLS LAST`,
    [userId, keys],
  );
  return new Map(rows.map((r) => [r.k, r.id]));
}

// ponytail: plafond de recherches Scryfall par import ; au-delà, les noms restent « non reconnus ».
const MAX_LOOKUPS = 30;

/**
 * Noms absents de la base (nom alternatif comme « Mechagodzilla, Battle Fortress »,
 * carte pas encore synchronisée) : résolus par Scryfall, puis impression choisie
 * comme les autres. Complète `ids` (frontKey du nom saisi -> card id).
 */
async function resolveAliases(db, userId, names, ids) {
  const todo = [...new Set(names.map(frontName))].slice(0, MAX_LOOKUPS);
  if (!todo.length) return;
  const found = await Promise.all(todo.map((n) => scryfall.getCardByName(n).catch(() => null)));
  const real = new Map(); // frontKey saisi -> nom Scryfall
  for (const [i, raw] of found.entries()) {
    if (!raw?.id) continue;
    // eslint-disable-next-line no-await-in-loop
    await ensureCard(raw.id); // carte absente de la base locale : insérée
    real.set(frontKey(todo[i]), raw.name);
  }
  const more = await resolvePrintings(userId, [...real.values()], db);
  for (const [k, name] of real) {
    const id = more.get(frontKey(name));
    if (id) ids.set(k, id);
  }
}

const printingKey = (e) => (e.set && e.number ? `${e.set}:${e.number}`.toLowerCase() : null);

/**
 * Impressions exactes indiquées par la liste (« (SET) numéro »), prioritaires sur
 * le choix par nom. → Map `set:numéro` -> card id ; absentes de la base : ignorées.
 */
async function exactPrintings(db, entries) {
  const keys = [...new Set(entries.map(printingKey).filter(Boolean))];
  if (!keys.length) return new Map();
  const { rows } = await db.query(
    `SELECT DISTINCT ON (k) lower(set_code || ':' || collector_number) AS k, id
     FROM cards WHERE lower(set_code || ':' || collector_number) = ANY($1::text[])
     ORDER BY k, id`,
    [keys],
  );
  return new Map(rows.map((r) => [r.k, r.id]));
}

/**
 * Ajoute des cartes ([{ name, quantity, zone, set?, number?, finish? }]) à un deck, impression choisie par
 * l'édition indiquée, sinon `resolvePrintings`. Les doublons (même impression, même zone) s'additionnent.
 * → noms non reconnus.
 */
export async function addCardsByName(db, userId, deckId, entries) {
  const exact = await exactPrintings(db, entries);
  const rest = entries.filter((e) => !exact.has(printingKey(e))).map((e) => e.name);
  const ids = await resolvePrintings(userId, rest, db);
  await resolveAliases(db, userId, rest.filter((n) => !ids.has(frontKey(n))), ids);
  const merged = new Map(); // `${id}:${zone}` -> { q, finish }
  const unknown = [];
  for (const { name, quantity, zone, finish, ...e } of entries) {
    const id = exact.get(printingKey(e)) || ids.get(frontKey(name));
    if (!id) { unknown.push(name); continue; }
    const k = `${id}:${ZONES.includes(zone) ? zone : 'main'}`;
    const prev = merged.get(k);
    merged.set(k, { q: (prev?.q || 0) + quantity, finish: prev?.finish || finish || 'nonfoil' });
  }
  if (merged.size) {
    const [cardIds, zones, qtys, finishes] = [[], [], [], []];
    for (const [k, { q, finish }] of merged) {
      const [id, zone] = k.split(':');
      cardIds.push(Number(id)); zones.push(zone); qtys.push(q); finishes.push(finish);
    }
    // ponytail: une ligne par impression et zone ; foil et non-foil de la même impression partagent la finition de la première
    await db.query(
      `INSERT INTO deck_cards (deck_id, card_id, zone, quantity, finish)
       SELECT $1, * FROM unnest($2::int[], $3::text[], $4::int[], $5::text[])
       ON CONFLICT (deck_id, card_id, zone) DO UPDATE SET quantity = deck_cards.quantity + EXCLUDED.quantity`,
      [deckId, cardIds, zones, qtys, finishes],
    );
  }
  return [...new Set(unknown)];
}

/** Lignes d'un ou plusieurs decks, avec la carte pointée. */
async function deckLines(deckIds) {
  const { rows } = await query(
    `SELECT dc.id, dc.deck_id, dc.zone, dc.quantity AS qty, dc.finish,
            c.scryfall_id, c.oracle_id, c.name, c.name_fr, c.set_code, c.set_name, c.collector_number,
            c.type_line, c.mana_cost, c.cmc, c.colors, c.color_identity, c.oracle_text,
            c.image_uri, c.image_uri_small, c.legalities, c.legal_commander,
            CASE WHEN dc.finish = 'nonfoil' THEN COALESCE(c.prices_eur, c.prices_eur_foil)
                 ELSE COALESCE(c.prices_eur_foil, c.prices_eur) END AS eur
     FROM deck_cards dc JOIN cards c ON c.id = dc.card_id
     WHERE dc.deck_id = ANY($1::int[])
     ORDER BY c.name`,
    [deckIds],
  );
  return rows.map((r) => ({
    ...r,
    cmc: r.cmc === null ? null : Number(r.cmc),
    eur: r.eur === null ? null : Number(r.eur),
    color_identity: r.color_identity || [],
    basic: BASIC_LANDS.has(frontKey(r.name)),
  }));
}

/** Besoins par nom sur les zones comptées → Map frontKey -> quantité. */
function neededByName(lines) {
  const needed = new Map();
  for (const l of lines) {
    if (!COUNTED.has(l.zone)) continue;
    const k = frontKey(l.name);
    needed.set(k, (needed.get(k) || 0) + l.qty);
  }
  return needed;
}

/** Possession par nom, toutes éditions (via `checkDeck`) → Map frontKey -> exemplaires. */
async function ownedByName(userId, names) {
  if (!names.length) return new Map();
  const { cards } = await checkDeck(userId, names.map((name) => ({ name, quantity: 1 })));
  return new Map(cards.map((c) => [frontKey(c.name), c.owned]));
}

/** % possédé (en exemplaires, hors terrains de base) ; null pour un deck vide. */
function ownedPct(needed, owned) {
  let need = 0;
  let have = 0;
  for (const [k, q] of needed) {
    if (BASIC_LANDS.has(k)) continue;
    need += q;
    have += Math.min(q, owned.get(k) || 0);
  }
  return need ? Math.round((100 * have) / need) : null;
}

// Formats à 100 cartes menés par un commandant : règles de construction de Commander.
export const COMMANDER_FORMATS = new Set(['commander', 'duel', 'predh', 'paupercommander']);

// Cartes qui autorisent plusieurs exemplaires malgré la règle de l'exemplaire unique.
const ANY_NUMBER = /deck can have (any number of|up to \w+) cards named/i;
const isCommanderCard = (l) => {
  const front = String(l.type_line || '').split(' // ')[0];
  return /^Legendary.*\b(Creature|Background)\b/.test(front) || /can be your commander/i.test(l.oracle_text || '');
};

/**
 * Contrôles de légalité. Pour tout format : légalité de chaque carte (hors « peut-être »).
 * Commander, Duel, PreDH, Pauper Commander : 100 cartes, exemplaire unique, identité couleur, 1 ou 2 commandants.
 * → [{ level: 'error' | 'warn', message, cards: [noms] }]
 */
export function legalityIssues(format, lines) {
  if (!FORMATS.includes(format) || format === 'casual') return [];
  const issues = [];
  const push = (level, message, cards = []) => issues.push({ level, message, cards: [...new Set(cards)].sort() });
  const inDeck = lines.filter((l) => l.zone !== 'maybe');
  const counted = lines.filter((l) => COUNTED.has(l.zone));

  const byStatus = { banned: [], not_legal: [], restricted: [] };
  const qty = new Map();
  for (const l of inDeck) qty.set(frontKey(l.name), (qty.get(frontKey(l.name)) || 0) + l.qty);
  let unknown = 0;
  for (const l of inDeck) {
    const st = l.legalities?.[format];
    if (!st) unknown += 1;
    else if (st === 'banned' || st === 'not_legal') byStatus[st].push(l.name);
    else if (st === 'restricted' && qty.get(frontKey(l.name)) > 1) byStatus.restricted.push(l.name);
  }
  if (byStatus.banned.length) push('error', 'Cartes bannies dans ce format', byStatus.banned);
  if (byStatus.not_legal.length) push('error', 'Cartes non légales dans ce format', byStatus.not_legal);
  if (byStatus.restricted.length) push('error', 'Cartes restreintes à un exemplaire', byStatus.restricted);
  if (unknown) push('warn', `Légalité inconnue pour ${unknown} carte(s) : relancer la synchro des cartes`);

  if (COMMANDER_FORMATS.has(format)) {
    const commanders = counted.filter((l) => l.zone === 'commander');
    const size = counted.reduce((s, l) => s + l.qty, 0);
    if (!commanders.length) push('warn', 'Aucun commandant désigné');
    else if (commanders.reduce((s, l) => s + l.qty, 0) > 2) push('error', 'Plus de deux commandants');
    const notCommander = commanders.filter((l) => !isCommanderCard(l)).map((l) => l.name);
    if (notCommander.length) push('error', 'Ne peut pas être commandant', notCommander);
    if (size !== 100) push(size > 100 ? 'error' : 'warn', `${size} cartes sur 100`);

    const dupes = [];
    const seen = new Map();
    for (const l of counted) {
      const k = frontKey(l.name);
      seen.set(k, (seen.get(k) || 0) + l.qty);
      if (seen.get(k) > 1 && !BASIC_LANDS.has(k) && !ANY_NUMBER.test(l.oracle_text || '')) dupes.push(l.name);
    }
    if (dupes.length) push('error', 'Exemplaire unique : cartes en plusieurs exemplaires', dupes);

    if (commanders.length) {
      const identity = new Set(commanders.flatMap((l) => l.color_identity));
      const off = counted.filter((l) => l.zone !== 'commander' && l.color_identity.some((c) => !identity.has(c)))
        .map((l) => l.name);
      if (off.length) push('error', 'Hors de l\'identité couleur du commandant', off);
    }
  }
  return issues;
}

/** Image de fond : celle choisie, sinon le commandant, sinon la carte la plus chère du deck. */
function coverOf(lines, chosen) {
  if (chosen) return chosen;
  const cmd = lines.find((l) => l.zone === 'commander' && l.image_uri);
  if (cmd) return cmd.image_uri;
  return [...lines].filter((l) => l.image_uri && COUNTED.has(l.zone))
    .sort((a, b) => (b.eur || 0) - (a.eur || 0))[0]?.image_uri || null;
}

/** Decks du compte : tuiles (image, identité, taille, % possédé). */
export async function listDecks(userId) {
  const { rows: decks } = await query(
`SELECT d.id, d.name, d.format, d.notes, d.created_at, d.updated_at,
            cc.scryfall_id AS cover_scryfall_id, cc.image_uri AS cover_image
     FROM decks d LEFT JOIN cards cc ON cc.id = d.cover_card_id
     WHERE d.user_id = $1 ORDER BY d.updated_at DESC`,
    [userId],
  );
  if (!decks.length) return [];
  const lines = await deckLines(decks.map((d) => d.id));
  const owned = await ownedByName(userId, [...new Set(lines.map((l) => l.name))]);
  return decks.map(({ cover_image: chosen, ...d }) => {
    const mine = lines.filter((l) => l.deck_id === d.id);
    const commanders = mine.filter((l) => l.zone === 'commander');
    return {
      ...d,
      cover: coverOf(mine, chosen),
      commanders: commanders.map((l) => l.name),
      color_identity: [...new Set(commanders.flatMap((l) => l.color_identity))],
      count: mine.filter((l) => COUNTED.has(l.zone)).reduce((s, l) => s + l.qty, 0),
      pct: ownedPct(neededByName(mine), owned),
    };
  });
}

/** Deck du compte, ou null. */
export async function getDeck(userId, deckId) {
  const { rows } = await query(
`SELECT d.id, d.name, d.format, d.notes, d.created_at, d.updated_at,
            cc.scryfall_id AS cover_scryfall_id, cc.image_uri AS cover_image
     FROM decks d LEFT JOIN cards cc ON cc.id = d.cover_card_id
     WHERE d.id = $1 AND d.user_id = $2`,
    [deckId, userId],
  );
  return rows[0] || null;
}

/** Autres decks du compte qui utilisent ces noms → Map frontKey -> [{ id, name }]. */
export async function decksUsing(userId, names, exceptDeckId = null) {
  const keys = [...new Set(names.map(frontKey))];
  if (!keys.length) return new Map();
  const { rows } = await query(
    `SELECT DISTINCT ${FRONT} AS k, d.id, d.name
     FROM deck_cards dc JOIN decks d ON d.id = dc.deck_id JOIN cards c ON c.id = dc.card_id
     WHERE d.user_id = $1 AND ${FRONT} = ANY($2::text[]) AND d.id IS DISTINCT FROM $3
     ORDER BY d.name`,
    [userId, keys, exceptDeckId],
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.k)) map.set(r.k, []);
    map.get(r.k).push({ id: r.id, name: r.name });
  }
  return map;
}

/**
 * Fiche deck : lignes avec possession (par nom, toutes éditions), manquants,
 * autres decks qui utilisent la carte ; coût de complétion (impression la moins
 * chère), valeur (impressions choisies), contrôles de légalité.
 */
export async function deckDetail(userId, deck) {
  const lines = await deckLines([deck.id]);
  const names = [...new Set(lines.map((l) => l.name))];
  const [owned, used] = await Promise.all([ownedByName(userId, names), decksUsing(userId, names, deck.id)]);
  const needed = neededByName(lines);

  const missing = [...needed].filter(([k, q]) => !BASIC_LANDS.has(k) && (owned.get(k) || 0) < q);
  const cheapest = await cardsByFront(missing.map(([k]) => k));
  const missingEur = missing.reduce((s, [k, q]) => s + (cheapest.get(k)?.eur || 0) * (q - (owned.get(k) || 0)), 0);
  const valueEur = lines.filter((l) => COUNTED.has(l.zone)).reduce((s, l) => s + (l.eur || 0) * l.qty, 0);

  const cards = lines.map(({ deck_id: _d, legalities: _l, oracle_text: _o, ...l }) => {
    const k = frontKey(l.name);
    const have = owned.get(k) || 0;
    return {
      ...l,
      owned: have,
      missing: COUNTED.has(l.zone) && !l.basic ? Math.max(0, (needed.get(k) || 0) - have) : 0,
      cheapest_eur: cheapest.get(k)?.eur ?? null,
      used_in: used.get(k) || [],
    };
  });
  const { cover_image: chosen, ...rest } = deck;
  return {
    deck: { ...rest, cover: coverOf(lines, chosen) },
    cards,
    summary: {
      count: [...needed.values()].reduce((s, q) => s + q, 0),
      pct: ownedPct(needed, owned),
      missingDistinct: missing.length,
      missingTotal: missing.reduce((s, [k, q]) => s + q - (owned.get(k) || 0), 0),
      missingEur: Number(missingEur.toFixed(2)),
      valueEur: Number(valueEur.toFixed(2)),
    },
    issues: legalityIssues(deck.format, lines),
  };
}

/** Impressions locales d'une carte (même nom, face avant) avec prix et exemplaires possédés. */
export async function printingsOf(userId, name) {
  const { rows } = await query(
    `SELECT c.id, c.scryfall_id, c.set_code, c.set_name, c.collector_number, c.image_uri_small,
            COALESCE(c.prices_eur, c.prices_eur_foil) AS eur,
            COALESCE((SELECT SUM(e.quantity) FROM collection_entries e WHERE e.card_id = c.id AND e.user_id = $1), 0)::int AS owned
     FROM cards c LEFT JOIN sets s ON s.code = c.set_code
     WHERE ${FRONT} = $2 AND ${PLAYABLE}
     ORDER BY owned DESC, s.released_at DESC NULLS LAST, c.collector_number`,
    [userId, frontKey(name)],
  );
  return rows.map((r) => ({ ...r, eur: r.eur === null ? null : Number(r.eur) }));
}
