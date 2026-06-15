/**
 * Index fonctionnel sur lower(set_code) : les lookups insensibles à la casse
 * (`/sets/:code/cards`, `/collection/owned?set=`) faisaient un seq scan sur ~90k
 * cartes car idx_cards_set (casse exacte) n'est pas utilisable pour lower(set_code).
 */
export const up = (pgm) => {
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_cards_set_lower ON cards (lower(set_code));');
};

export const down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_cards_set_lower;');
};
