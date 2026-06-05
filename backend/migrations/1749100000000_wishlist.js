/** Liste de souhaits : cartes convoitées (non possédées), pour suivre les cibles d'achat. */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id        SERIAL PRIMARY KEY,
      user_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
      card_id   INTEGER REFERENCES cards(id),
      note      TEXT,
      added_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, card_id)
    );
    CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS wishlist;');
};
