// Logique pure de la page Commandants (filtres, typal, score du Matchmaker).
// Sans React ni import d'app : testée avec `node --test` (logic.test.js).

export const COLORS = ['W', 'U', 'B', 'R', 'G'];

export const PAIRINGS = {
  partner: 'Partenaire',
  partner_with: 'Partenaire avec',
  choose_background: 'Choisir un Historique',
  background: 'Historique',
  friends_forever: 'Amis pour toujours',
  doctors_companion: 'Compagnon du Docteur',
  doctor: 'Docteur',
};

export const COLOR_MODES = [
  { value: 'exact', label: 'Exactement' },
  { value: 'include', label: 'Incluant' },
  { value: 'atmost', label: 'Au plus' },
];

export const SORTS = [
  { value: 'popular', label: 'Popularité' },
  { value: 'price', label: 'Prix' },
  { value: 'new', label: 'Nouveauté' },
  { value: 'az', label: 'A–Z' },
];

export const EMPTY_FILTERS = {
  colors: [], colorMode: 'exact', cmcMax: '', creatureType: '', pairing: '',
  priceMax: '', noGameChangers: false, ownedOnly: false, q: '',
};

/** Types de créature de la face avant (« Legendary Creature — Elf Druid » → [Elf, Druid]). */
export function creatureTypes(typeLine) {
  const front = String(typeLine || '').split(' // ')[0];
  if (!/\bCreature\b/.test(front)) return [];
  const sub = front.split('—')[1];
  return sub ? sub.trim().split(/\s+/) : [];
}

/** Identité couleur vs sélection (vide = incolore en mode « exactement »). */
export function colorMatch(identity, selected, mode) {
  const ci = new Set(identity || []);
  const sel = new Set(selected);
  if (mode === 'include') return [...sel].every((c) => ci.has(c));
  if (mode === 'atmost') return [...ci].every((c) => sel.has(c));
  return ci.size === sel.size && [...sel].every((c) => ci.has(c));
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function test(c, key, f, owned) {
  switch (key) {
    case 'colors': return colorMatch(c.color_identity, f.colors, f.colorMode);
    case 'cmcMax': return c.cmc !== null && c.cmc <= Number(f.cmcMax);
    case 'creatureType': return creatureTypes(c.type_line).some((t) => norm(t) === norm(f.creatureType));
    case 'pairing': return f.pairing === 'none' ? !c.pairing : c.pairing === f.pairing;
    case 'priceMax': return c.eur !== null && c.eur <= Number(f.priceMax);
    case 'noGameChangers': return !c.game_changer;
    case 'ownedOnly': return owned.has(c.oracle_id);
    case 'q': {
      const q = norm(f.q);
      return norm(c.name).includes(q) || norm(c.name_fr).includes(q) || norm(c.oracle_text).includes(q);
    }
    default: return true;
  }
}

/** Clés des filtres actifs (la sélection de couleurs vide ne filtre pas). */
export function activeKeys(f) {
  return Object.keys(EMPTY_FILTERS).filter((k) => {
    if (k === 'colorMode') return false;
    if (k === 'colors') return f.colors.length > 0;
    return Boolean(f[k]);
  });
}

export function applyFilters(list, f, owned, skip = null) {
  const keys = activeKeys(f).filter((k) => k !== skip);
  return list.filter((c) => keys.every((k) => test(c, k, f, owned)));
}

/** Pour un résultat vide : combien de commandants rendrait le retrait de chaque filtre. */
export function relaxSuggestions(list, f, owned) {
  return activeKeys(f)
    .map((key) => ({ key, count: applyFilters(list, f, owned, key).length }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function sortCommanders(list, sort) {
  const out = [...list];
  const nullsLast = (a, b) => (a ?? Infinity) - (b ?? Infinity);
  if (sort === 'price') out.sort((a, b) => nullsLast(a.eur, b.eur) || a.name.localeCompare(b.name));
  else if (sort === 'new') out.sort((a, b) => String(b.released_at || '').localeCompare(String(a.released_at || '')));
  else if (sort === 'az') out.sort((a, b) => a.name.localeCompare(b.name));
  else out.sort((a, b) => nullsLast(a.rank, b.rank) || a.name.localeCompare(b.name));
  return out;
}

// --- Matchmaker ---------------------------------------------------------------

export const BUDGETS = [
  { value: 5, label: 'Moins de 5 €' },
  { value: 20, label: 'Moins de 20 €' },
  { value: 50, label: 'Moins de 50 €' },
  { value: 0, label: 'Peu importe' },
];
export const POWERS = [
  { value: 'casual', label: 'Détendu' },
  { value: 'focused', label: 'Optimisé' },
  { value: 'high', label: 'Compétitif' },
  { value: '', label: 'Peu importe' },
];
export const ORIGINS = [
  { value: 'owned', label: 'Dans ma collection' },
  { value: 'discover', label: 'À découvrir' },
  { value: '', label: 'Peu importe' },
];
export const EMPTY_ANSWERS = { colors: [], theme: '', budget: 0, power: '', origin: '' };

const YEAR_MS = 365 * 24 * 3600 * 1000;

/**
 * Score d'un commandant pour les réponses du quiz, avec les raisons affichées.
 * null = exclu (Historique seul, hors couleurs, déjà possédé en mode découverte…).
 * ctx : { owned: Set<oracle_id>, theme: Set<oracle_id> | null, now: ms }
 */
export function scoreCommander(c, a, ctx) {
  if (c.pairing === 'background') return null;
  const reasons = [];
  let score = 0;
  const add = (pts, why) => { score += pts; if (why) reasons.push(why); };

  if (a.colors.length) {
    if (!colorMatch(c.color_identity, a.colors, 'atmost')) return null;
    if (colorMatch(c.color_identity, a.colors, 'exact')) add(30, 'Exactement tes couleurs');
    else add(10, 'Dans tes couleurs');
  }

  if (a.theme && ctx.theme) {
    if (ctx.theme.has(c.oracle_id)) add(35, 'Commandant phare du thème');
    else add(-15);
  }

  if (a.budget) {
    if (c.eur !== null && c.eur <= a.budget) add(15, `${c.eur.toFixed(2)} €, dans le budget`);
    else return null;
  }

  const rank = c.rank ?? Infinity;
  if (a.power === 'high') {
    if (c.game_changer) add(20, 'Game Changer');
    if (rank <= 150) add(10, 'Parmi les plus joués');
  } else if (a.power === 'focused') {
    if (rank <= 500) add(10, 'Très joué');
    if (c.game_changer) add(5);
  } else if (a.power === 'casual') {
    if (c.game_changer) return null;
    if (rank > 300 && rank !== Infinity) add(10, 'Hors des sentiers battus');
  }

  const owned = ctx.owned.has(c.oracle_id);
  if (a.origin === 'owned') {
    if (!owned) return null;
    add(20, 'Déjà dans ta collection');
  } else if (a.origin === 'discover') {
    if (owned) return null;
    if (c.released_at && ctx.now - new Date(c.released_at).getTime() < YEAR_MS) add(10, 'Sorti cette année');
  } else if (owned) {
    add(5, 'Déjà dans ta collection');
  }

  // Départage par popularité : 0 à 10 points, décroissant avec le rang.
  if (rank !== Infinity) add(Math.max(0, 10 - Math.log10(rank) * 3));
  return { score: Math.round(score), reasons };
}

export function matchmake(list, a, ctx, limit = 12) {
  const out = [];
  for (const c of list) {
    const s = scoreCommander(c, a, ctx);
    if (s) out.push({ ...s, commander: c });
  }
  return out.sort((x, y) => y.score - x.score || (x.commander.rank ?? Infinity) - (y.commander.rank ?? Infinity)).slice(0, limit);
}

// --- Mémoire d'onglet (sessionStorage, peut être indisponible) -----------------

export function loadSession(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveSession(key, value) {
  try {
    if (value === undefined) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch { /* stockage indisponible : on oublie */ }
}

// --- Variantes de deck EDHREC (thème × niveau × prix) --------------------------

export const DECK_BUDGETS = [['', 'Moyen'], ['budget', 'Budget'], ['expensive', 'Cher']];
export const DECK_BRACKETS = [
  ['', 'Tous niveaux'], ['exhibition', '1 · Exhibition'], ['core', '2 · Core'],
  ['upgraded', '3 · Upgraded'], ['optimized', '4 · Optimized'], ['cedh', '5 · cEDH'],
];

/** Titre d'une variante : « Deck moyen », « Deck Tokens · Cher · 4 · Optimized »… */
export function variantTitle({ theme, bracket, budget }, themeName) {
  const parts = [
    theme && (themeName || theme),
    budget && DECK_BUDGETS.find(([v]) => v === budget)?.[1],
    bracket && DECK_BRACKETS.find(([v]) => v === bracket)?.[1],
  ].filter(Boolean);
  return parts.length ? `Deck ${parts.join(' · ')}` : 'Deck moyen';
}

// --- Decklist -----------------------------------------------------------------

// Ordre d'affichage des groupes (comme Moxfield) ; une carte va dans le premier qui correspond.
export const DECK_GROUPS = [
  ['Creature', 'Créatures'], ['Land', 'Terrains'], ['Planeswalker', 'Planeswalkers'], ['Battle', 'Batailles'],
  ['Instant', 'Éphémères'], ['Sorcery', 'Rituels'], ['Artifact', 'Artefacts'], ['Enchantment', 'Enchantements'],
];

/** Groupe d'une carte d'après la face avant de sa ligne de type (« Autres » si inconnue). */
export function deckGroup(typeLine) {
  const front = String(typeLine || '').split(' // ')[0];
  return DECK_GROUPS.find(([t]) => new RegExp(`\\b${t}\\b`).test(front))?.[1] || 'Autres';
}

/** Liste texte (Moxfield / MTGO) : commandant puis cartes du deck. */
export function deckText(commanderName, deck) {
  return [`1 ${commanderName}`, ...deck.map((c) => `${c.qty} ${c.name}`)].join('\n');
}
