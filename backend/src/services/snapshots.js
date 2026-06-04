import { query } from '../config/db.js';
import { UNIT_EUR, UNIT_USD } from './pricing.js';

/**
 * Matérialise les snapshots du jour pour tous les utilisateurs :
 *  - collection_snapshots      (valeur totale par user)
 *  - collection_set_snapshots  (valeur par user × édition)
 * Idempotent : ré-exécutable le même jour (ON CONFLICT … DO UPDATE).
 */
export async function runSnapshots() {
  await query(
    `INSERT INTO collection_snapshots
       (user_id, total_value_eur, total_value_usd, card_count, unique_card_count, snapshot_date)
     SELECT e.user_id,
            COALESCE(SUM((${UNIT_EUR}) * e.quantity), 0),
            COALESCE(SUM((${UNIT_USD}) * e.quantity), 0),
            COALESCE(SUM(e.quantity), 0),
            COUNT(*),
            CURRENT_DATE
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     GROUP BY e.user_id
     ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
       total_value_eur   = EXCLUDED.total_value_eur,
       total_value_usd   = EXCLUDED.total_value_usd,
       card_count        = EXCLUDED.card_count,
       unique_card_count = EXCLUDED.unique_card_count`,
  );

  await query(
    `INSERT INTO collection_set_snapshots
       (user_id, set_code, snapshot_date, total_value_eur, total_value_usd, card_count, unique_card_count)
     SELECT e.user_id, c.set_code, CURRENT_DATE,
            COALESCE(SUM((${UNIT_EUR}) * e.quantity), 0),
            COALESCE(SUM((${UNIT_USD}) * e.quantity), 0),
            COALESCE(SUM(e.quantity), 0),
            COUNT(*)
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE c.set_code IS NOT NULL
     GROUP BY e.user_id, c.set_code
     ON CONFLICT (user_id, set_code, snapshot_date) DO UPDATE SET
       total_value_eur   = EXCLUDED.total_value_eur,
       total_value_usd   = EXCLUDED.total_value_usd,
       card_count        = EXCLUDED.card_count,
       unique_card_count = EXCLUDED.unique_card_count`,
  );

  return true;
}

/** Courbe de valeur globale (§5.3 GET /collection/snapshots?days=90). */
export async function getSnapshots(userId, days = 90) {
  const { rows } = await query(
    `SELECT snapshot_date, total_value_eur, total_value_usd, card_count, unique_card_count
     FROM collection_snapshots
     WHERE user_id = $1 AND snapshot_date >= CURRENT_DATE - $2::int
     ORDER BY snapshot_date`,
    [userId, days],
  );
  return rows;
}

/** Courbe par édition (réutilisée au Sprint 7). */
export async function getSetSnapshots(userId, setCode, days = 90) {
  const { rows } = await query(
    `SELECT snapshot_date, total_value_eur, total_value_usd, card_count, unique_card_count
     FROM collection_set_snapshots
     WHERE user_id = $1 AND set_code = $2 AND snapshot_date >= CURRENT_DATE - $3::int
     ORDER BY snapshot_date`,
    [userId, setCode, days],
  );
  return rows;
}
