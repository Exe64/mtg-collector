/**
 * - Emplacement physique des cartes : colonne `location` ajoutée à la clé d'unicité
 *   (un même exemplaire rangé à deux endroits = deux entrées). NOT NULL DEFAULT ''
 *   pour préserver la détection de conflit (les NULL seraient considérés distincts).
 * - `printed_size` sur les sets : taille officielle du « base set strict » (dénominateur
 *   exact de complétion, hors variants/promos).
 */

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE collection_entries ADD COLUMN IF NOT EXISTS location VARCHAR(100) NOT NULL DEFAULT '';

    -- Remplace la contrainte d'unicité (nom auto-généré → recherche dynamique)
    DO $$
    DECLARE c text;
    BEGIN
      SELECT conname INTO c FROM pg_constraint
      WHERE conrelid = 'collection_entries'::regclass AND contype = 'u';
      IF c IS NOT NULL THEN EXECUTE 'ALTER TABLE collection_entries DROP CONSTRAINT ' || quote_ident(c); END IF;
    END $$;

    ALTER TABLE collection_entries ADD CONSTRAINT collection_entries_variant_key
      UNIQUE (user_id, card_id, finish, condition, language, location);

    ALTER TABLE sets ADD COLUMN IF NOT EXISTS printed_size INTEGER;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE collection_entries DROP CONSTRAINT IF EXISTS collection_entries_variant_key;
    ALTER TABLE collection_entries ADD CONSTRAINT collection_entries_legacy_key
      UNIQUE (user_id, card_id, finish, condition, language);
    ALTER TABLE collection_entries DROP COLUMN IF EXISTS location;
    ALTER TABLE sets DROP COLUMN IF EXISTS printed_size;
  `);
};
