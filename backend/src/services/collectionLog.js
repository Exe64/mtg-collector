import { query, withTransaction } from '../config/db.js';
import { logger } from '../config/logger.js';

// Sources annulables depuis le journal (import : variantes agrégées, et undo :
// pas d'annulation d'annulation — on évite les chaînes ambiguës).
const UNDOABLE_SOURCES = ['add', 'adjust', 'edit', 'delete'];

/**
 * Journalise des mouvements de collection.
 * `changes` : [{ cardId, delta, finish, condition?, language?, location? }]
 *             — delta signé (> 0 ajout, < 0 retrait).
 * `source`  : add | adjust | edit | delete | import | undo | move.
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
    params.push(c.cardId, c.delta, c.finish || 'nonfoil', c.condition ?? null, c.language ?? null, c.location ?? null);
    const i = params.length;
    return `($1, $${i - 5}, $${i - 4}, $${i - 3}, $${i - 2}, $${i - 1}, $${i}, $2)`;
  });
  const sql = `INSERT INTO collection_log (user_id, card_id, quantity_delta, finish, condition, language, location, source)
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

const VARIANT_KEYS = ['finish', 'condition', 'language', 'location'];

/**
 * Lignes de journal d'une entrée modifiée (`before` → `after`, lignes de
 * collection_entries). Changement de variante → paire 'move' (−n ancienne,
 * +n nouvelle, non annulable) ; changement de quantité → delta 'edit'.
 * Renvoie [{ source, change }].
 */
export function entryChanges(before, after) {
  const variant = (r) => ({ cardId: r.card_id, finish: r.finish, condition: r.condition, language: r.language, location: r.location });
  const out = [];
  if (VARIANT_KEYS.some((k) => before[k] !== after[k])) {
    out.push({ source: 'move', change: { ...variant(before), delta: -before.quantity } });
    out.push({ source: 'move', change: { ...variant(after), delta: before.quantity } });
  }
  if (after.quantity !== before.quantity) {
    out.push({ source: 'edit', change: { ...variant(after), delta: after.quantity - before.quantity } });
  }
  return out;
}

/** Journalise des `entryChanges` (groupées par source) dans la transaction de `client`. */
export async function logEntryChanges(userId, changes, client) {
  for (const source of ['move', 'edit']) {
    // eslint-disable-next-line no-await-in-loop
    await logChanges(userId, changes.filter((c) => c.source === source).map((c) => c.change), source, client);
  }
}

/** Mouvements des `days` derniers jours, du plus récent au plus ancien. */
export async function getLog(userId, days = 30) {
  const { rows } = await query(
    `SELECT l.id, l.quantity_delta, l.finish, l.condition, l.language, l.location, l.source, l.created_at, l.undone_at,
            c.scryfall_id, c.name, c.set_code, c.image_uri_small
     FROM collection_log l JOIN cards c ON c.id = l.card_id
     WHERE l.user_id = $1 AND l.created_at >= NOW() - make_interval(days => $2::int)
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT 2000`,
    [userId, days],
  );
  return rows.map((r) => ({ ...r, undoable: !r.undone_at && UNDOABLE_SOURCES.includes(r.source) }));
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Applique un delta signé à une variante (finish/condition/langue/emplacement),
 * dans la transaction de `client`. Un retrait est borné à ce qui existe et
 * supprime l'entrée quand elle tombe à 0. Renvoie { applied, quantity }.
 */
export async function applyDelta(client, userId, cardId, variant, delta) {
  if (delta > 0) {
    const { rows } = await client.query(
      `INSERT INTO collection_entries (user_id, card_id, quantity, finish, condition, language, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, card_id, finish, condition, language, location)
       DO UPDATE SET quantity = collection_entries.quantity + EXCLUDED.quantity
       RETURNING quantity`,
      [userId, cardId, delta, ...variant],
    );
    return { applied: delta, quantity: rows[0].quantity };
  }
  const { rows } = await client.query(
    `SELECT id, quantity FROM collection_entries
     WHERE user_id = $1 AND card_id = $2 AND finish = $3 AND condition = $4 AND language = $5 AND location = $6
     FOR UPDATE`,
    [userId, cardId, ...variant],
  );
  const entry = rows[0];
  if (!entry) return { applied: 0, quantity: 0 };
  const removed = Math.min(entry.quantity, -delta);
  const left = entry.quantity - removed;
  if (left <= 0) {
    await client.query('DELETE FROM collection_entries WHERE id = $1', [entry.id]);
  } else {
    await client.query('UPDATE collection_entries SET quantity = $1 WHERE id = $2', [left, entry.id]);
  }
  return { applied: -removed, quantity: left };
}

/**
 * Annule un mouvement du journal : réapplique le delta inverse sur la même
 * variante (finish/condition/langue/emplacement), marque la ligne `undone_at`
 * et trace l'annulation (source 'undo'). Transactionnel.
 * Un retrait est borné à ce qui existe encore dans la collection.
 */
export function undoLogEntry(userId, logId) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT * FROM collection_log WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [logId, userId],
    );
    const log = rows[0];
    if (!log) throw httpError(404, 'Mouvement introuvable');
    if (log.undone_at) throw httpError(409, 'Mouvement déjà annulé');
    if (!UNDOABLE_SOURCES.includes(log.source)) throw httpError(400, 'Ce type de mouvement ne peut pas être annulé');

    // Lignes antérieures à l'ajout des colonnes de variante : on retombe sur les défauts
    const variant = [log.finish, log.condition || 'NM', log.language || 'en', log.location || ''];
    const { applied } = await applyDelta(client, userId, log.card_id, variant, -log.quantity_delta);
    if (!applied) throw httpError(409, 'Cette variante n\'est plus dans la collection, rien à retirer');

    await client.query('UPDATE collection_log SET undone_at = NOW() WHERE id = $1', [logId]);
    await logChanges(
      userId,
      [{ cardId: log.card_id, delta: applied, finish: log.finish, condition: variant[1], language: variant[2], location: variant[3] }],
      'undo',
      client,
    );
    return { applied };
  });
}
