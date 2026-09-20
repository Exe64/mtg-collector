import { query } from '../config/db.js';
import { logger } from '../config/logger.js';
import * as scryfall from './scryfall.js';

const MTGJSON_SETLIST = 'https://mtgjson.com/api/v5/SetList.json';

/** Upsert en lot des extensions dans la table `sets`. */
export async function upsertSets(sets) {
  if (!sets.length) return 0;
  const cols = ['code', 'name', 'released_at', 'card_count', 'icon_uri', 'set_type', 'printed_size'];
  const params = [];
  const rowsSql = sets.map((s) => {
    const vals = [
      s.code, s.name, s.released_at || null, s.card_count ?? null,
      s.icon_svg_uri || null, s.set_type || null, s.printed_size ?? null,
    ];
    const ph = vals.map((v) => {
      params.push(v);
      return `$${params.length}`;
    });
    return `(${ph.join(', ')}, NOW())`;
  });
  await query(
    `INSERT INTO sets (${cols.join(', ')}, updated_at)
     VALUES ${rowsSql.join(', ')}
     ON CONFLICT (code) DO UPDATE SET
       name = EXCLUDED.name, released_at = EXCLUDED.released_at,
       card_count = EXCLUDED.card_count, icon_uri = EXCLUDED.icon_uri,
       set_type = EXCLUDED.set_type,
       -- Scryfall ne donne plus printed_size sur la plupart des sets : ne pas écraser
       -- la valeur complétée depuis MTGJSON (fillPrintedSize) avec un NULL.
       printed_size = COALESCE(EXCLUDED.printed_size, sets.printed_size),
       updated_at = NOW()`,
    params,
  );
  return sets.length;
}

/**
 * Complète `printed_size` (dernier n° du set de base) là où Scryfall ne le donne
 * plus — il ne le sert que sur ~170 sets sur 1050, et sans lui le front met tout
 * dans « base » et laisse l'onglet Extras vide. MTGJSON publie la même donnée
 * (`baseSetSize`) pour presque tous les sets. Best-effort : si MTGJSON est
 * injoignable, on garde l'existant.
 */
export async function fillPrintedSize() {
  let sets;
  try {
    const res = await fetch(MTGJSON_SETLIST, { signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    ({ data: sets } = await res.json());
  } catch (e) {
    logger.warn({ err: e.message }, 'printed_size : MTGJSON injoignable, sets inchangés');
    return 0;
  }
  // baseSetSize ≤ 1 = pas de set de base identifiable (jetons, Secret Lair,
  // Alchemy) : laisser NULL (tout en « base ») plutôt que tout basculer en extras.
  const params = [];
  const rows = (sets || [])
    .filter((s) => s.code && Number(s.baseSetSize) > 1)
    .map((s) => {
      params.push(s.code.toLowerCase(), Number(s.baseSetSize));
      return `($${params.length - 1}::text, $${params.length}::int)`;
    });
  if (!rows.length) return 0;
  // Uniquement là où Scryfall ne dit rien : sa valeur reste prioritaire.
  const { rowCount } = await query(
    `UPDATE sets s SET printed_size = v.printed_size, updated_at = NOW()
     FROM (VALUES ${rows.join(', ')}) AS v(code, printed_size)
     WHERE s.code = v.code AND s.printed_size IS NULL`,
    params,
  );
  logger.info(`printed_size complété depuis MTGJSON pour ${rowCount} set(s)`);
  return rowCount;
}

/** Récupère toutes les extensions depuis Scryfall et les persiste. */
export async function syncSets() {
  const data = await scryfall.getSets();
  if (data?.data) await upsertSets(data.data);
  await fillPrintedSize();
  return data?.data?.length || 0;
}

export function toClientSet(s) {
  return {
    code: s.code,
    name: s.name,
    released_at: s.released_at || null,
    card_count: s.card_count ?? null,
    printed_size: s.printed_size ?? null,
    icon: s.icon_svg_uri || s.icon_uri || null,
    set_type: s.set_type || null,
  };
}

// Depuis une ligne de la table `sets` (servie en local, pas via Scryfall)
export function dbSetToClient(r) {
  return {
    code: r.code,
    name: r.name,
    released_at: r.released_at || null,
    card_count: r.card_count ?? null,
    printed_size: r.printed_size ?? null,
    icon: r.icon_uri || null,
    set_type: r.set_type || null,
  };
}
