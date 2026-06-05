import { query } from '../config/db.js';
import * as scryfall from './scryfall.js';

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
       set_type = EXCLUDED.set_type, printed_size = EXCLUDED.printed_size, updated_at = NOW()`,
    params,
  );
  return sets.length;
}

/** Récupère toutes les extensions depuis Scryfall et les persiste. */
export async function syncSets() {
  const data = await scryfall.getSets();
  if (data?.data) await upsertSets(data.data);
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
