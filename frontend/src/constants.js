// Échelle de conditions Cardmarket (ordre du meilleur au pire état).
export const CONDITIONS = [
  { value: 'MT', label: 'Mint' },
  { value: 'NM', label: 'Near Mint' },
  { value: 'EX', label: 'Excellent' },
  { value: 'GD', label: 'Good' },
  { value: 'LP', label: 'Light Played' },
  { value: 'PL', label: 'Played' },
  { value: 'PO', label: 'Poor' },
];

export const CONDITION_ORDER = CONDITIONS.map((c) => c.value);
export const CONDITION_LABEL = Object.fromEntries(CONDITIONS.map((c) => [c.value, c.label]));

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'es', label: 'Español' },
  { value: 'pt', label: 'Português' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'ru', label: 'Русский' },
  { value: 'zhs', label: '简体中文' },
  { value: 'zht', label: '繁體中文' },
];

// Couleur d'identité Magic (pour les liserés de cartes-UI)
export const MANA_HEX = { W: '#e9e4c8', U: '#4f8df0', B: '#6b6478', R: '#e0483f', G: '#3aa45b', M: '#c9a227', C: '#9aa0a6' };
export function identityColor(ci) {
  if (!ci || ci.length === 0) return MANA_HEX.C; // incolore
  if (ci.length > 1) return MANA_HEX.M; // multicolore → or
  return MANA_HEX[ci[0]] || MANA_HEX.C;
}
export function identityStyle(ci) {
  return { boxShadow: `inset 4px 0 0 0 ${identityColor(ci)}` };
}

// Fond de tuile : teinte d'identité qui s'efface vers le bas
export function identityTint(ci) {
  return { backgroundImage: `linear-gradient(to bottom, ${identityColor(ci)}38, transparent 80%)` };
}

// Illustration seule (recadrage Scryfall) dérivée d'une URL d'image de carte jpg
export const artCrop = (url) => url?.replace(/\/(small|normal|large)\/(front|back)\//, '/art_crop/$2/');

// Tokens d'un coût de mana "{2}{U}{U}" → classes mana-font
export function manaSymbols(cost) {
  if (!cost) return [];
  return (cost.match(/\{([^}]+)\}/g) || []).map((t) => t.slice(1, -1).replace('/', '').toLowerCase());
}

export const CONDITION_COLOR = {
  MT: '#22c55e',
  NM: '#4ade80',
  EX: '#a3e635',
  GD: '#eab308',
  LP: '#f59e0b',
  PL: '#f97316',
  PO: '#ef4444',
};

// Liens de l'auteur (pied de page, encart dons de l'administration)
export const AUTHOR_LINKS = {
  github: 'https://github.com/Exe64',
  repo: 'https://github.com/Exe64/mtg-collector',
  kofi: 'https://ko-fi.com/juliendumur',
  paypal: 'https://www.paypal.com/paypalme/juliendumur',
};
