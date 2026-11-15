/** Image de fond d'un deck choisie par l'utilisateur (plan #31) ; NULL = commandant, sinon la carte la plus chère. */
export const up = (pgm) => {
  pgm.sql('ALTER TABLE decks ADD COLUMN IF NOT EXISTS cover_card_id INTEGER REFERENCES cards(id) ON DELETE SET NULL;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE decks DROP COLUMN IF EXISTS cover_card_id;');
};
