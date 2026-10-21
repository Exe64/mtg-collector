/** Présélection de commandants (☆, 4 max par compte, plafond appliqué côté route). */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS commander_shortlist (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      oracle_id  UUID NOT NULL,
      added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, oracle_id)
    );
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS commander_shortlist;');
};
