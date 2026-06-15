/**
 * Détection de réutilisation des refresh tokens (signal de vol) :
 *  - family_id : lignée d'une session (toutes les rotations issues d'un login).
 *  - used_at   : marque un token déjà tourné (NULL = actif).
 * Un token déjà tourné re-présenté hors fenêtre de grâce => révocation de toute la famille.
 */
export const up = (pgm) => {
  pgm.sql(`ALTER TABLE refresh_tokens
    ADD COLUMN family_id UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN used_at   TIMESTAMPTZ;`);
  pgm.sql('CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);');
};

export const down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_refresh_tokens_family;');
  pgm.sql('ALTER TABLE refresh_tokens DROP COLUMN family_id, DROP COLUMN used_at;');
};
