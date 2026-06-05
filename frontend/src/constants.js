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

export const CONDITION_COLOR = {
  MT: '#22c55e',
  NM: '#4ade80',
  EX: '#a3e635',
  GD: '#eab308',
  LP: '#f59e0b',
  PL: '#f97316',
  PO: '#ef4444',
};
