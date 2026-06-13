/**
 * Journal des mouvements de collection : chaque ajout / retrait de cartes
 * est tracé avec un delta signé (> 0 ajout, < 0 retrait), la finition et
 * l'origine (add | adjust | edit | delete | import) — pour savoir ce qui
 * a été modifié jour par jour.
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS collection_log (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
      card_id         INTEGER REFERENCES cards(id) ON DELETE CASCADE,
      quantity_delta  INTEGER NOT NULL CHECK (quantity_delta <> 0),
      finish          VARCHAR(10) NOT NULL DEFAULT 'nonfoil',
      source          VARCHAR(20) NOT NULL DEFAULT 'add',
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_collection_log_user_date
      ON collection_log(user_id, created_at DESC);
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS collection_log;');
};
