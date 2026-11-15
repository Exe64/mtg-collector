/**
 * Decks enregistrés (plan #31) : listes virtuelles, aucun lien avec l'inventaire.
 * Une ligne de deck pointe une impression (`card_id`) dans une zone.
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS decks (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        VARCHAR(200) NOT NULL,
      format      VARCHAR(30) NOT NULL DEFAULT 'commander',
      notes       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_decks_user ON decks (user_id);

    CREATE TABLE IF NOT EXISTS deck_cards (
      id        SERIAL PRIMARY KEY,
      deck_id   INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      card_id   INTEGER NOT NULL REFERENCES cards(id),
      quantity  INTEGER NOT NULL CHECK (quantity > 0),
      zone      VARCHAR(10) NOT NULL DEFAULT 'main' CHECK (zone IN ('commander', 'main', 'side', 'maybe')),
      UNIQUE (deck_id, card_id, zone)
    );
    CREATE INDEX IF NOT EXISTS idx_deck_cards_card ON deck_cards (card_id);
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS deck_cards; DROP TABLE IF EXISTS decks;');
};
