/**
 * Cache des API externes (EDHREC, Commander Spellbook) pour « Trouver un commandant ».
 *
 *  - Une ligne par ressource (`edhrec:commander:<slug>`, `spellbook:combos:<nom>`…),
 *    données déjà réduites à ce qu'affiche l'app. `data` NULL = ressource absente
 *    (404), mise en cache aussi pour ne pas la redemander à chaque visite.
 *  - Persistant (survit à un vidage Redis) : le remplir demande ~1 requête/s.
 *    Fraîcheur (7 j) gérée côté service via `fetched_at`.
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS external_cache (
      key         TEXT PRIMARY KEY,
      data        JSONB,
      fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS external_cache;');
};
