import { query } from '../config/db.js';

// Réglages globaux + défauts. Toute nouvelle clé doit être ajoutée ici.
export const DEFAULTS = {
  price_job_hours: 12,   // périodicité du job prix (heures)
  default_threshold: 20, // seuil de variation par défaut (%)
  default_days: 7,       // période par défaut des mouvements (jours)
};

function coerce(key, raw) {
  const n = Number(raw);
  const v = Number.isFinite(n) ? n : DEFAULTS[key];
  if (key === 'price_job_hours') return Math.min(Math.max(Math.round(v), 1), 24);
  if (key === 'default_threshold') return Math.min(Math.max(v, 1), 1000);
  if (key === 'default_days') return Math.min(Math.max(Math.round(v), 1), 365);
  return raw;
}

let cache = null;

export async function getSettings() {
  if (cache) return cache;
  const out = { ...DEFAULTS };
  try {
    const { rows } = await query('SELECT key, value FROM app_settings');
    for (const r of rows) if (r.key in DEFAULTS) out[r.key] = coerce(r.key, r.value);
  } catch {
    /* table absente (avant migration) → on garde les défauts */
  }
  cache = out;
  return out;
}

export async function updateSettings(patch) {
  for (const key of Object.keys(DEFAULTS)) {
    const raw = patch[key];
    if (raw === undefined || raw === null || raw === '') continue;
    // eslint-disable-next-line no-await-in-loop
    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, String(coerce(key, raw))],
    );
  }
  cache = null; // invalide le cache mémoire
  return getSettings();
}
