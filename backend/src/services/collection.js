import { query } from '../config/db.js';
import { UNIT_EUR, UNIT_USD } from './pricing.js';

const SORT_COLUMNS = {
  name: 'c.name',
  set: 'c.set_code',
  rarity: 'c.rarity',
  quantity: 'e.quantity',
  added_at: 'e.added_at',
  value: `(${UNIT_EUR}) * e.quantity`,
};

function mapEntry(r) {
  return {
    id: r.id,
    quantity: r.quantity,
    finish: r.finish,
    condition: r.condition,
    language: r.language,
    acquired_price: r.acquired_price,
    acquired_at: r.acquired_at,
    notes: r.notes,
    added_at: r.added_at,
    unit_price_eur: r.unit_price_eur,
    total_price_eur: r.total_price_eur,
    card: {
      scryfall_id: r.scryfall_id,
      name: r.name,
      set: r.set_code,
      set_name: r.set_name,
      collector_number: r.collector_number,
      rarity: r.rarity,
      image: r.image_uri,
      image_small: r.image_uri_small,
      colors: r.colors,
      color_identity: r.color_identity,
      type_line: r.type_line,
    },
  };
}

/** Liste paginée + filtrée + triée de la collection d'un utilisateur. */
export async function getCollection(userId, opts = {}) {
  const conds = ['e.user_id = $1'];
  const params = [userId];
  const filter = (sql, value) => {
    params.push(value);
    conds.push(sql(params.length));
  };

  if (opts.q) filter((i) => `c.name ILIKE $${i}`, `%${opts.q}%`);
  if (opts.set) filter((i) => `c.set_code = $${i}`, opts.set);
  if (opts.rarity) filter((i) => `c.rarity = $${i}`, opts.rarity);
  if (opts.condition) filter((i) => `e.condition = $${i}`, opts.condition);
  if (opts.finish) filter((i) => `e.finish = $${i}`, opts.finish);
  if (opts.language) filter((i) => `e.language = $${i}`, opts.language);
  if (opts.type) filter((i) => `c.type_line ILIKE $${i}`, `%${opts.type}%`);

  if (opts.color === 'C') {
    conds.push('(c.color_identity IS NULL OR array_length(c.color_identity, 1) IS NULL)');
  } else if (opts.color === 'M') {
    conds.push('array_length(c.color_identity, 1) > 1');
  } else if (opts.color) {
    filter((i) => `$${i} = ANY(c.color_identity)`, opts.color);
  }

  if (opts.cmc !== undefined && opts.cmc !== '') filter((i) => `c.cmc = $${i}`, Number(opts.cmc));
  if (opts.cmcMin) filter((i) => `c.cmc >= $${i}`, Number(opts.cmcMin));

  const where = conds.join(' AND ');
  const sortCol = SORT_COLUMNS[opts.sort] || SORT_COLUMNS.added_at;
  const order = String(opts.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const countRes = await query(
    `SELECT COUNT(*)::int AS total
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE ${where}`,
    params,
  );
  const total = countRes.rows[0].total;

  const pageSize = Math.min(Number(opts.pageSize) || 50, 200);
  const page = Math.max(Number(opts.page) || 1, 1);
  params.push(pageSize);
  const limIdx = params.length;
  params.push((page - 1) * pageSize);
  const offIdx = params.length;

  const rowsRes = await query(
    `SELECT e.id, e.quantity, e.finish, e.condition, e.language, e.acquired_price,
            e.acquired_at, e.notes, e.added_at,
            c.scryfall_id, c.name, c.set_code, c.set_name, c.collector_number, c.rarity,
            c.image_uri, c.image_uri_small, c.colors, c.color_identity, c.type_line,
            (${UNIT_EUR})::numeric(10,2)               AS unit_price_eur,
            ((${UNIT_EUR}) * e.quantity)::numeric(12,2) AS total_price_eur
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE ${where}
     ORDER BY ${sortCol} ${order} NULLS LAST, e.id
     LIMIT $${limIdx} OFFSET $${offIdx}`,
    params,
  );

  return { entries: rowsRes.rows.map(mapEntry), total, page, pageSize };
}

/** Totaux légers (pour l'en-tête de la liste). */
export async function getCollectionTotals(userId) {
  const { rows } = await query(
    `SELECT COALESCE(SUM((${UNIT_EUR}) * e.quantity), 0)::numeric(14,2) AS total_value_eur,
            COALESCE(SUM(e.quantity), 0)::int                          AS card_count,
            COUNT(*)::int                                              AS unique_card_count
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE e.user_id = $1`,
    [userId],
  );
  return {
    totalValueEur: Number(rows[0].total_value_eur),
    cardCount: rows[0].card_count,
    uniqueCardCount: rows[0].unique_card_count,
  };
}

/** Statistiques complètes du dashboard (§5.3). */
export async function getStats(userId) {
  const totals = await query(
    `SELECT COALESCE(SUM((${UNIT_EUR}) * e.quantity), 0)::numeric(14,2) AS total_value_eur,
            COALESCE(SUM((${UNIT_USD}) * e.quantity), 0)::numeric(14,2) AS total_value_usd,
            COALESCE(SUM(e.quantity), 0)::int                          AS card_count,
            COUNT(*)::int                                              AS unique_card_count,
            COUNT(DISTINCT c.set_code)::int                            AS set_count
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE e.user_id = $1`,
    [userId],
  );

  const topCards = await query(
    `SELECT c.scryfall_id, c.name, c.set_code, c.image_uri_small, e.finish, e.quantity,
            (${UNIT_EUR})::numeric(10,2)               AS unit_price_eur,
            ((${UNIT_EUR}) * e.quantity)::numeric(12,2) AS total_price_eur
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE e.user_id = $1
     ORDER BY total_price_eur DESC NULLS LAST
     LIMIT 10`,
    [userId],
  );

  const colors = await query(
    `SELECT CASE
              WHEN array_length(c.color_identity, 1) IS NULL THEN 'C'
              WHEN array_length(c.color_identity, 1) > 1     THEN 'M'
              ELSE c.color_identity[1]
            END AS bucket,
            SUM(e.quantity)::int AS count
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE e.user_id = $1
     GROUP BY bucket`,
    [userId],
  );

  const rarities = await query(
    `SELECT c.rarity AS bucket, SUM(e.quantity)::int AS count
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE e.user_id = $1
     GROUP BY c.rarity`,
    [userId],
  );

  const conditions = await query(
    `SELECT e.condition AS bucket, SUM(e.quantity)::int AS count
     FROM collection_entries e
     WHERE e.user_id = $1
     GROUP BY e.condition`,
    [userId],
  );

  // Type principal (ordre de priorité : terrain > créature > planeswalker > …)
  const types = await query(
    `SELECT CASE
              WHEN c.type_line ILIKE '%land%'         THEN 'Terrain'
              WHEN c.type_line ILIKE '%creature%'     THEN 'Créature'
              WHEN c.type_line ILIKE '%planeswalker%' THEN 'Planeswalker'
              WHEN c.type_line ILIKE '%battle%'       THEN 'Bataille'
              WHEN c.type_line ILIKE '%instant%'      THEN 'Éphémère'
              WHEN c.type_line ILIKE '%sorcery%'      THEN 'Rituel'
              WHEN c.type_line ILIKE '%artifact%'     THEN 'Artefact'
              WHEN c.type_line ILIKE '%enchantment%'  THEN 'Enchantement'
              ELSE 'Autre'
            END AS bucket,
            SUM(e.quantity)::int AS count
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE e.user_id = $1
     GROUP BY bucket
     ORDER BY count DESC`,
    [userId],
  );

  const t = totals.rows[0];
  return {
    totalValue: { eur: Number(t.total_value_eur), usd: Number(t.total_value_usd) },
    cardCount: t.card_count,
    uniqueCardCount: t.unique_card_count,
    setCount: t.set_count,
    topCards: topCards.rows,
    colorBreakdown: colors.rows,
    rarityBreakdown: rarities.rows,
    conditionBreakdown: conditions.rows,
    typeBreakdown: types.rows,
  };
}
