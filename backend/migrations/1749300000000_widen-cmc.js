/**
 * Élargit cards.cmc : certaines cartes un-set (ex. Gleemax, {1000000}) ont une
 * valeur de mana > 9999,99 qui débordait NUMERIC(6,2) lors du sync bulk.
 */
export const up = (pgm) => {
  pgm.sql('ALTER TABLE cards ALTER COLUMN cmc TYPE NUMERIC(12,2);');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE cards ALTER COLUMN cmc TYPE NUMERIC(6,2);');
};
