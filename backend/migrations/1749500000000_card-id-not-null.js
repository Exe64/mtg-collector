/**
 * collection_entries.card_id était nullable sans raison : toute entrée référence
 * forcément une carte (FK vers cards). On verrouille la contrainte NOT NULL.
 * (Échoue volontairement s'il existait des lignes orphelines à card_id NULL.)
 */
export const up = (pgm) => {
  pgm.sql('ALTER TABLE collection_entries ALTER COLUMN card_id SET NOT NULL;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE collection_entries ALTER COLUMN card_id DROP NOT NULL;');
};
