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

// Même règle que UNIT_EUR, mais sur une ligne d'historique (alias `h`), la finition
// suivie étant portée par l'alias `o`. Sans ça une impression foil-only (promo
// prerelease…) a un h.eur toujours NULL et disparaît des mouvements de prix.
export const HIST_EUR_BY_FINISH =
  `CASE o.finish
     WHEN 'foil'   THEN h.eur_foil
     WHEN 'etched' THEN COALESCE(h.eur_etched, h.eur_foil)
     ELSE h.eur
   END`;

// Historique quand aucune finition n'est connue (wishlist : on convoite une carte,
// pas une finition) — première cote disponible.
export const HIST_EUR_ANY = 'COALESCE(h.eur, h.eur_foil, h.eur_etched)';
