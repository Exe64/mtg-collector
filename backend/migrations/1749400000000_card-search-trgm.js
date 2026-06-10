/**
 * Recherche : index trigramme (pg_trgm) sur cards.name et cards.type_line.
 * Les filtres `ILIKE '%q%'` (wildcard en tête) ne peuvent pas utiliser un index
 * B-tree → scan séquentiel sur ~90k cartes. Un index GIN trigramme rend ces
 * recherches indexables (cards/search, autocomplétion, filtres de type).
 */
export const up = (pgm) => {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_cards_name_trgm ON cards USING gin (name gin_trgm_ops);');
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_cards_type_line_trgm ON cards USING gin (type_line gin_trgm_ops);');
};

export const down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_cards_type_line_trgm;');
  pgm.sql('DROP INDEX IF EXISTS idx_cards_name_trgm;');
  // L'extension pg_trgm est laissée en place (peut servir ailleurs).
};
