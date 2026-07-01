/**
 * Nom français des cartes (impressions « lang:fr » de Scryfall).
 *
 *  - `name_fr` est rempli par le job `syncFrenchNames` (bulk `all_cards`), qui
 *    ne conserve que les impressions françaises et propage le nom par oracle_id
 *    (toutes les impressions d'une même carte partagent le nom FR, même celles
 *    d'un set jamais sorti en français).
 *  - Nullable : beaucoup de cartes n'ont pas de nom FR (promos, Un-sets,
 *    exclusivités digitales) → l'affichage et le tri retombent sur `name`.
 *  - Index trigramme (miroir de `idx_cards_name_trgm`) pour rendre la recherche
 *    collection sur le nom FR indexable (ILIKE '%q%').
 */
export const up = (pgm) => {
  pgm.sql('ALTER TABLE cards ADD COLUMN IF NOT EXISTS name_fr VARCHAR(500);');
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_cards_name_fr_trgm ON cards USING gin (name_fr gin_trgm_ops);');
};

export const down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_cards_name_fr_trgm;');
  pgm.sql('ALTER TABLE cards DROP COLUMN IF EXISTS name_fr;');
};
