import { query } from '../config/db.js';
import { logger } from '../config/logger.js';

/**
 * Journalise des mouvements de collection.
 * `changes` : [{ cardId, delta, finish }] — delta signé (> 0 ajout, < 0 retrait).
 * `source`  : add | adjust | edit | delete | import.
 * `client`  : client pg optionnel (mouvement inscrit dans la transaction en cours).
 *
 * Hors transaction, un échec d'écriture du journal ne doit jamais faire échouer
 * l'opération métier déjà committée → l'erreur est loggée puis avalée.
 */
export async function logChanges(userId, changes, source, client = null) {
  const rows = changes.filter((c) => c.delta !== 0);
  if (!rows.length) return;

  const params = [userId, source];
  const values = rows.map((c) => {
    params.push(c.cardId, c.delta, c.finish || 'nonfoil');
    const i = params.length;
    return `($1, $${i - 2}, $${i - 1}, $${i}, $2)`;
  });
  const sql = `INSERT INTO collection_log (user_id, card_id, quantity_delta, finish, source)
               VALUES ${values.join(', ')}`;

  if (client) {
    await client.query(sql, params); // dans une transaction : laisse l'erreur remonter (rollback)
    return;
  }
  try {
    await query(sql, params);
  } catch (err) {
    logger.error({ err, userId, source }, 'écriture du journal de collection échouée');
  }
}

/** Mouvements des `days` derniers jours, du plus récent au plus ancien. */
export async function getLog(userId, days = 30) {
  const { rows } = await query(
    `SELECT l.id, l.quantity_delta, l.finish, l.source, l.created_at,
            c.scryfall_id, c.name, c.set_code, c.image_uri_small
     FROM collection_log l JOIN cards c ON c.id = l.card_id
     WHERE l.user_id = $1 AND l.created_at >= NOW() - make_interval(days => $2::int)
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT 2000`,
    [userId, days],
  );
  return rows;
}
