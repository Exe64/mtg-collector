import { query } from '../config/db.js';
import { logger } from '../config/logger.js';
import { ensureCard } from './cards.js';

/** Alertes de prix d'un utilisateur (avec carte + prix courant). */
export async function listAlerts(userId) {
  const { rows } = await query(
    `SELECT a.id, a.direction, a.threshold_eur, a.active, a.triggered_at, a.created_at,
            c.scryfall_id, c.name, c.set_code, c.image_uri_small, c.prices_eur AS current_eur
     FROM price_alerts a JOIN cards c ON c.id = a.card_id
     WHERE a.user_id = $1
     ORDER BY a.active DESC, a.created_at DESC`,
    [userId],
  );
  return rows;
}

/** Crée (ou réarme) une alerte de prix. */
export async function createAlert(userId, scryfallId, direction, thresholdEur) {
  const card = await ensureCard(scryfallId);
  if (!card) {
    const err = new Error('Carte introuvable');
    err.status = 404;
    throw err;
  }
  const { rows } = await query(
    `INSERT INTO price_alerts (user_id, card_id, direction, threshold_eur)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, card_id, direction)
     DO UPDATE SET threshold_eur = EXCLUDED.threshold_eur, active = TRUE, triggered_at = NULL
     RETURNING id`,
    [userId, card.id, direction, thresholdEur],
  );
  return rows[0];
}

export async function deleteAlert(userId, id) {
  const { rowCount } = await query(
    'DELETE FROM price_alerts WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  return rowCount > 0;
}

/**
 * Évalue toutes les alertes actives contre le prix courant : celles dont le seuil
 * est franchi sont désactivées (one-shot, réarmables) et génèrent une notification.
 * Renvoie le nombre d'alertes déclenchées. Appelé par le job quotidien.
 */
export async function evaluateAlerts() {
  const { rows } = await query(
    `WITH fired AS (
       UPDATE price_alerts a
       SET active = FALSE, triggered_at = NOW()
       FROM cards c
       WHERE a.card_id = c.id AND a.active AND c.prices_eur IS NOT NULL
         AND ((a.direction = 'below' AND c.prices_eur <= a.threshold_eur)
           OR (a.direction = 'above' AND c.prices_eur >= a.threshold_eur))
       RETURNING a.user_id, a.card_id, a.direction, a.threshold_eur, c.name, c.prices_eur
     )
     INSERT INTO notifications (user_id, card_id, type, message)
     SELECT user_id, card_id, 'price_alert',
            name || ' est ' ||
            CASE WHEN direction = 'below' THEN 'descendue à ' ELSE 'montée à ' END ||
            prices_eur || ' € (seuil ' || threshold_eur || ' €)'
     FROM fired
     RETURNING id`,
  );
  if (rows.length) logger.info(`alertes de prix : ${rows.length} déclenchée(s)`);
  return rows.length;
}

/** Notifications récentes (90 j) + compteur non lues. */
export async function listNotifications(userId) {
  const { rows } = await query(
    `SELECT n.id, n.type, n.message, n.read_at, n.created_at, c.scryfall_id
     FROM notifications n LEFT JOIN cards c ON c.id = n.card_id
     WHERE n.user_id = $1 AND n.created_at >= NOW() - INTERVAL '90 days'
     ORDER BY n.created_at DESC
     LIMIT 100`,
    [userId],
  );
  const unread = rows.filter((r) => !r.read_at).length;
  return { notifications: rows, unread };
}

/** Marque une notification (ou toutes) comme lue(s). */
export async function markNotificationsRead(userId, id = null) {
  if (id) {
    await query('UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL', [id, userId]);
  } else {
    await query('UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL', [userId]);
  }
}
