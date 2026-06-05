/**
 * Modèle d'accès fermé : un drapeau admin sur les utilisateurs.
 * Le premier compte (propriétaire) est promu administrateur.
 */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
    UPDATE users SET is_admin = TRUE
      WHERE id = (SELECT id FROM users ORDER BY id ASC LIMIT 1);
  `);
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE users DROP COLUMN IF EXISTS is_admin;');
};
