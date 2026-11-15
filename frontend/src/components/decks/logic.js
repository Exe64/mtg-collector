import { DECK_GROUPS, deckGroup } from '../commanders/logic.js';

// Formats (clés des légalités Scryfall, même liste que le backend).
export const FORMATS = [
  ['commander', 'Commander'], ['standard', 'Standard'], ['pioneer', 'Pioneer'], ['modern', 'Modern'],
  ['legacy', 'Legacy'], ['vintage', 'Vintage'], ['pauper', 'Pauper'], ['paupercommander', 'Pauper Commander'],
  ['oathbreaker', 'Oathbreaker'], ['brawl', 'Brawl'], ['standardbrawl', 'Standard Brawl'],
  ['historic', 'Historic'], ['timeless', 'Timeless'], ['premodern', 'Premodern'], ['predh', 'PreDH'],
  ['oldschool', 'Old School'], ['penny', 'Penny Dreadful'], ['duel', 'Duel Commander'], ['casual', 'Libre (aucun contrôle)'],
];
export const formatLabel = (f) => FORMATS.find(([v]) => v === f)?.[1] || f;

// Zones d'un deck, dans l'ordre d'affichage ; `header` = en-tête de la liste texte.
export const ZONES = [
  ['commander', 'Commandant', 'Commander'], ['main', 'Principal', 'Deck'],
  ['side', 'Réserve', 'Sideboard'], ['maybe', 'Peut-être', 'Maybeboard'],
];
const COUNTED = new Set(['commander', 'main']);
const GROUP_ORDER = [...DECK_GROUPS.map(([, label]) => label), 'Autres'];

/** Cartes groupées par type (ordre Moxfield), triées par nom → [[libellé, cartes]]. */
export function groupByType(cards) {
  const map = new Map();
  for (const c of cards) {
    const g = deckGroup(c.type_line);
    if (!map.has(g)) map.set(g, []);
    map.get(g).push(c);
  }
  return GROUP_ORDER.filter((g) => map.has(g))
    .map((g) => [g, map.get(g).sort((a, b) => a.name.localeCompare(b.name))]);
}

/**
 * Statistiques des zones comptées : courbe de mana (hors terrains, 7 = 7+),
 * cartes par couleur (incolores à part), exemplaires par type.
 */
export function deckStats(cards) {
  const counted = cards.filter((c) => COUNTED.has(c.zone));
  const curve = Array(8).fill(0);
  const colors = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  for (const c of counted) {
    const front = String(c.type_line || '').split(' // ')[0];
    if (/\bLand\b/.test(front)) continue;
    curve[Math.min(7, Math.floor(c.cmc || 0))] += c.qty;
    const cs = c.colors?.length ? c.colors : ['C'];
    for (const k of cs) if (k in colors) colors[k] += c.qty;
  }
  const types = groupByType(counted).map(([label, list]) => [label, list.reduce((s, c) => s + c.qty, 0)]);
  return { curve, colors, types };
}

/** Liste texte par sections (Moxfield / MTGO), relisible par l'import. */
export function savedDeckText(cards) {
  return ZONES.map(([zone, , header]) => {
    const lines = cards.filter((c) => c.zone === zone).sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => `${c.qty} ${c.name}`);
    return lines.length ? [header, ...lines].join('\n') : null;
  }).filter(Boolean).join('\n\n');
}
