/**
 * Réglages globaux (admin) : table clé/valeur simple.
 * Les valeurs sont validées/clampées côté service ; les défauts y sont aussi.
 */
export const up = (pgm) => {
  pgm.sql(`CREATE TABLE app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE app_settings;');
};
