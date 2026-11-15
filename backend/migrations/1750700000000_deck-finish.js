/** Finition d'une ligne de deck (plan #31) : foil / etched indiqués à l'import, prix en conséquence. */
export const up = (pgm) => {
  pgm.sql(`ALTER TABLE deck_cards ADD COLUMN IF NOT EXISTS finish VARCHAR(10) NOT NULL DEFAULT 'nonfoil'
           CHECK (finish IN ('nonfoil','foil','etched'));`);
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE deck_cards DROP COLUMN IF EXISTS finish;');
};
