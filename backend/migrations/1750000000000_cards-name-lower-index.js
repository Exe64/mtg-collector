/**
 * Index fonctionnel sur lower(name) : la résolution par nom de l'import CSV
 * (`lower(name) = lower($1)`) faisait un seq scan sur ~120k cartes (~350 ms par ligne).
 */
export const up = (pgm) => {
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_cards_name_lower ON cards (lower(name));');
};

export const down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_cards_name_lower;');
};
