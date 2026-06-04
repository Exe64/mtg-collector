// Fragments SQL réutilisés (collection + snapshots) pour calculer le prix unitaire
// selon la finition. Supposent les alias `e` (collection_entries) et `c` (cards).

export const UNIT_EUR =
  `CASE e.finish
     WHEN 'foil'   THEN c.prices_eur_foil
     WHEN 'etched' THEN COALESCE(c.prices_eur_etched, c.prices_eur_foil)
     ELSE c.prices_eur
   END`;

export const UNIT_USD =
  `CASE WHEN e.finish = 'nonfoil' THEN c.prices_usd ELSE c.prices_usd_foil END`;
