/**
 * Légalités Scryfall complètes (plan #31, decks multi-formats).
 * Colonne nullable : ajout sans réécriture ; remplie au prochain `sync:bulk`.
 * `legal_commander` est conservé (index, catalogue #4).
 */
export const up = (pgm) => {
  pgm.sql('ALTER TABLE cards ADD COLUMN IF NOT EXISTS legalities JSONB;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE cards DROP COLUMN IF EXISTS legalities;');
};
