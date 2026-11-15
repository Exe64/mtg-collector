import { query } from '../config/db.js';
import { UNIT_EUR, UNIT_USD, HIST_EUR_BY_FINISH } from './pricing.js';

const SORT_COLUMNS = {
  name: 'c.name',
  set: 'c.set_code',
  type: 'c.type_line',
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
    location: r.location,
    acquired_price: r.acquired_price,
    acquired_at: r.acquired_at,
    notes: r.notes,
    added_at: r.added_at,
    unit_price_eur: r.unit_price_eur,
    total_price_eur: r.total_price_eur,
    card: {
      scryfall_id: r.scryfall_id,
      name: r.name,
      name_fr: r.name_fr || null,
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

// Construit le WHERE + params partagés (liste, comptes, groupes).
function buildFilters(userId, opts) {
  const conds = ['e.user_id = $1'];
  const params = [userId];
  const filter = (sql, value) => {
    params.push(value);
    conds.push(sql(params.length));
  };

  if (opts.q) filter((i) => `(c.name ILIKE $${i} OR c.name_fr ILIKE $${i})`, `%${opts.q}%`);
  if (opts.set) filter((i) => `c.set_code = $${i}`, opts.set);
  if (opts.rarity) filter((i) => `c.rarity = $${i}`, opts.rarity);
  if (opts.condition) filter((i) => `e.condition = $${i}`, opts.condition);
  // 'foil' couvre foil + etched ; 'nonfoil' est exact
  if (opts.finish === 'foil') conds.push(`e.finish <> 'nonfoil'`);
  else if (opts.finish) filter((i) => `e.finish = $${i}`, opts.finish);
  if (opts.language) filter((i) => `e.language = $${i}`, opts.language);
  // !== undefined (et pas "truthy") pour pouvoir filtrer l'emplacement vide « Non classé »
  if (opts.location !== undefined) filter((i) => `e.location = $${i}`, opts.location);
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

  return { where: conds.join(' AND '), params };
}

/**
 * Agrégats par dimension sur TOUTE la collection (filtres appliqués).
 * by : 'set' (défaut) | 'color' | 'rarity' | 'location'
 * Renvoie [{ key, label, count, total_eur }] — `key` sert de filtre à l'ouverture.
 */
export async function getCollectionGroups(userId, opts = {}, by = 'set') {
  const { where, params } = buildFilters(userId, opts);
  let keyExpr;
  let labelExpr;
  if (by === 'rarity') { keyExpr = 'c.rarity'; labelExpr = 'c.rarity'; }
  else if (by === 'location') { keyExpr = 'e.location'; labelExpr = 'e.location'; }
  else if (by === 'color') {
    keyExpr = `CASE WHEN array_length(c.color_identity, 1) IS NULL THEN 'C'
                    WHEN array_length(c.color_identity, 1) > 1 THEN 'M'
                    ELSE c.color_identity[1] END`;
    labelExpr = keyExpr;
  } else { keyExpr = 'c.set_code'; labelExpr = 'MAX(c.set_name)'; }

  const { rows } = await query(
    `SELECT ${keyExpr} AS key, ${labelExpr} AS label, COUNT(*)::int AS count,
            COALESCE(SUM((${UNIT_EUR}) * e.quantity), 0)::numeric(12,2) AS total_eur
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE ${where}
     GROUP BY ${keyExpr}
     ORDER BY total_eur DESC NULLS LAST`,
    params,
  );
  return rows;
}

/** Liste paginée + filtrée + triée de la collection d'un utilisateur. */
export async function getCollection(userId, opts = {}) {
  const { where, params } = buildFilters(userId, opts);
  const sortCol = SORT_COLUMNS[opts.sort] || SORT_COLUMNS.added_at;
  const order = String(opts.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const countRes = await query(
    `SELECT COUNT(*)::int AS total
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE ${where}`,
    params,
  );
  const total = countRes.rows[0].total;

  const pageSize = Math.min(Number(opts.pageSize) || 50, 500);
  const page = Math.max(Number(opts.page) || 1, 1);
  params.push(pageSize);
  const limIdx = params.length;
  params.push((page - 1) * pageSize);
  const offIdx = params.length;

  const rowsRes = await query(
    `SELECT e.id, e.quantity, e.finish, e.condition, e.language, e.location, e.acquired_price,
            e.acquired_at, e.notes, e.added_at,
            c.scryfall_id, c.name, c.name_fr, c.set_code, c.set_name, c.collector_number, c.rarity,
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
  // Toutes ces requêtes sont indépendantes → exécutées en parallèle (latence ÷ ~10).
  const moversSelect = `SELECT c.scryfall_id, c.name, c.set_code, c.image_uri_small, e.quantity,
            e.acquired_price, (${UNIT_EUR})::numeric(10,2) AS unit_eur,
            (((${UNIT_EUR}) - e.acquired_price) * e.quantity)::numeric(12,2) AS gain
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE e.user_id = $1 AND e.acquired_price IS NOT NULL AND (${UNIT_EUR}) IS NOT NULL`;

  const [totals, topCards, colors, rarities, conditions, types, values, gainers, losers] = await Promise.all([
    // Totaux + plus-value (cartes avec prix d'achat) + fraîcheur des prix : un seul passage
    query(
      `SELECT COALESCE(SUM((${UNIT_EUR}) * e.quantity), 0)::numeric(14,2) AS total_value_eur,
              COALESCE(SUM((${UNIT_USD}) * e.quantity), 0)::numeric(14,2) AS total_value_usd,
              COALESCE(SUM(e.quantity), 0)::int                          AS card_count,
              COUNT(*)::int                                              AS unique_card_count,
              COUNT(DISTINCT c.set_code)::int                            AS set_count,
              COALESCE(SUM(e.acquired_price * e.quantity), 0)::numeric(14,2) AS acquired_total,
              COALESCE(SUM(((${UNIT_EUR}) * e.quantity)) FILTER (WHERE e.acquired_price IS NOT NULL), 0)::numeric(14,2) AS market_priced,
              COUNT(*) FILTER (WHERE e.acquired_price IS NOT NULL)::int  AS priced_count,
              MAX(c.updated_at)                                          AS prices_updated_at
       FROM collection_entries e JOIN cards c ON c.id = e.card_id
       WHERE e.user_id = $1`,
      [userId],
    ),
    query(
      `SELECT c.scryfall_id, c.name, c.set_code, c.image_uri_small, e.finish, e.quantity,
              (${UNIT_EUR})::numeric(10,2)               AS unit_price_eur,
              ((${UNIT_EUR}) * e.quantity)::numeric(12,2) AS total_price_eur
       FROM collection_entries e JOIN cards c ON c.id = e.card_id
       WHERE e.user_id = $1
       ORDER BY unit_price_eur DESC NULLS LAST
       LIMIT 10`,
      [userId],
    ),
    query(
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
    ),
    query(
      `SELECT c.rarity AS bucket, SUM(e.quantity)::int AS count
       FROM collection_entries e JOIN cards c ON c.id = e.card_id
       WHERE e.user_id = $1
       GROUP BY c.rarity`,
      [userId],
    ),
    query(
      `SELECT e.condition AS bucket, SUM(e.quantity)::int AS count
       FROM collection_entries e
       WHERE e.user_id = $1
       GROUP BY e.condition`,
      [userId],
    ),
    // Type principal (ordre de priorité : terrain > créature > planeswalker > …)
    query(
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
    ),
    // Répartition par paliers de valeur unitaire (« ce qui dort dans les cartons »)
    query(
      `SELECT bucket, SUM(quantity)::int AS count, COALESCE(SUM(quantity * unit), 0)::numeric(14,2) AS value
       FROM (
         SELECT e.quantity, (${UNIT_EUR}) AS unit
         FROM collection_entries e JOIN cards c ON c.id = e.card_id
         WHERE e.user_id = $1
       ) x
       CROSS JOIN LATERAL (
         SELECT CASE
           WHEN unit IS NULL          THEN 'Sans prix'
           WHEN unit < 0.10           THEN '< 0,10 €'
           WHEN unit < 1              THEN '0,10–0,99 €'
           WHEN unit < 5              THEN '1–4,99 €'
           WHEN unit < 20             THEN '5–19,99 €'
           ELSE '≥ 20 €'
         END AS bucket
       ) b
       GROUP BY bucket`,
      [userId],
    ),
    query(`${moversSelect} ORDER BY gain DESC NULLS LAST LIMIT 5`, [userId]),
    query(`${moversSelect} AND (((${UNIT_EUR}) - e.acquired_price)) < 0 ORDER BY gain ASC LIMIT 5`, [userId]),
  ]);

  const t = totals.rows[0];
  const p = t;
  const acquired = Number(p.acquired_total);
  const market = Number(p.market_priced);
  const profitability = {
    acquiredTotal: acquired,
    marketValue: market,
    gain: Number((market - acquired).toFixed(2)),
    gainPct: acquired > 0 ? Number((((market - acquired) / acquired) * 100).toFixed(1)) : null,
    pricedCount: p.priced_count,
    topGainers: gainers.rows,
    topLosers: losers.rows,
  };

  return {
    pricesUpdatedAt: t.prices_updated_at,
    totalValue: { eur: Number(t.total_value_eur), usd: Number(t.total_value_usd) },
    cardCount: t.card_count,
    uniqueCardCount: t.unique_card_count,
    setCount: t.set_count,
    profitability,
    topCards: topCards.rows,
    colorBreakdown: colors.rows,
    rarityBreakdown: rarities.rows,
    conditionBreakdown: conditions.rows,
    typeBreakdown: types.rows,
    valueBreakdown: values.rows,
  };
}

/**
 * Mouvements de prix des cartes possédées sur les `days` derniers jours
 * (compare le dernier snapshot au plus récent ≤ date-days) :
 *  - gainers : top 10 des hausses (en € de variation unitaire)
 *  - losers  : top 10 des baisses (en € de variation unitaire)
 *  - spikes  : cartes ayant varié de ≥ threshold % (toutes, plafonné à 50)
 */
export async function getPriceMovers(userId, days = 7, threshold = 20, limit = 10) {
  const { rows } = await query(
    `WITH owned AS (
       -- Finition suivie : celle réellement possédée. Le non-foil prime (cas courant
       -- et seul cas où plusieurs finitions coexistent) ; à défaut on suit le foil,
       -- sinon les impressions foil-only n'ont aucun historique en euros à comparer.
       SELECT c.id AS card_id, c.scryfall_id, c.name, c.set_code, c.image_uri_small,
              CASE WHEN bool_or(e.finish = 'nonfoil') THEN 'nonfoil'
                   WHEN bool_or(e.finish = 'etched')  THEN 'etched'
                   ELSE 'foil' END AS finish
       FROM cards c JOIN collection_entries e ON e.card_id = c.id
       WHERE e.user_id = $1
       GROUP BY c.id, c.scryfall_id, c.name, c.set_code, c.image_uri_small
     )
     -- Deux lectures d'index par carte (PK card_id, snapshot_date), indépendantes de la
     -- profondeur d'historique : dernier snapshot, puis le plus récent ≤ dernier - days.
     SELECT o.scryfall_id, o.name, o.set_code, o.image_uri_small, o.finish AS tracked_finish,
            l.eur AS current_eur, r.eur AS past_eur,
            (l.eur - r.eur)::numeric(10,2) AS diff_eur,
            round(((l.eur - r.eur) / NULLIF(r.eur, 0)) * 100, 1) AS pct
     FROM owned o
     CROSS JOIN LATERAL (
       SELECT h.snapshot_date, (${HIST_EUR_BY_FINISH}) AS eur
       FROM card_price_history h WHERE h.card_id = o.card_id
       ORDER BY h.snapshot_date DESC LIMIT 1
     ) l
     CROSS JOIN LATERAL (
       SELECT (${HIST_EUR_BY_FINISH}) AS eur
       FROM card_price_history h
       WHERE h.card_id = o.card_id AND h.snapshot_date <= l.snapshot_date - $2::int
       ORDER BY h.snapshot_date DESC LIMIT 1
     ) r
     WHERE r.eur > 0 AND l.eur IS NOT NULL AND l.eur <> r.eur`,
    [userId, days],
  );

  const cap = Math.min(Math.max(Number(limit) || 10, 1), 200);
  const byDiff = (a, b) => Number(b.diff_eur) - Number(a.diff_eur);
  return {
    gainers: rows.filter((r) => Number(r.diff_eur) > 0).sort(byDiff).slice(0, cap),
    losers: rows.filter((r) => Number(r.diff_eur) < 0).sort(byDiff).reverse().slice(0, cap),
    spikes: rows
      .filter((r) => Math.abs(Number(r.pct)) >= threshold)
      .sort((a, b) => Math.abs(Number(b.pct)) - Math.abs(Number(a.pct)))
      .slice(0, cap),
  };
}
