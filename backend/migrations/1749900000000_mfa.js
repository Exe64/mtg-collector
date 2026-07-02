/**
 * MFA TOTP (opt-in par utilisateur) + codes de secours à usage unique.
 *   mfa_secret        : secret base32 (défini au setup, actif quand mfa_enabled=TRUE)
 *   mfa_enabled       : le second facteur est exigé à la connexion
 *   mfa_backup_codes  : tableau de hashs SHA-256 (hex) ; un code consommé est retiré
 */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE users DROP COLUMN IF EXISTS mfa_secret;
    ALTER TABLE users DROP COLUMN IF EXISTS mfa_enabled;
    ALTER TABLE users DROP COLUMN IF EXISTS mfa_backup_codes;
  `);
};
