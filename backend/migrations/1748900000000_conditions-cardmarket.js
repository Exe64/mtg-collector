/**
 * Passage à l'échelle de conditions Cardmarket :
 *   MT (Mint), NM (Near Mint), EX (Excellent), GD (Good),
 *   LP (Light Played), PL (Played), PO (Poor)
 *
 * Remappage injectif des anciennes valeurs (NM/LP/MP/HP/DMG) pour éviter
 * toute collision avec la contrainte UNIQUE (user_id, card_id, finish, condition, language).
 */

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE collection_entries DROP CONSTRAINT IF EXISTS collection_entries_condition_check;
    ALTER TABLE collection_entries ALTER COLUMN condition DROP DEFAULT;

    UPDATE collection_entries SET condition = CASE condition
      WHEN 'MP'  THEN 'GD'
      WHEN 'HP'  THEN 'PL'
      WHEN 'DMG' THEN 'PO'
      ELSE condition
    END;

    ALTER TABLE collection_entries ALTER COLUMN condition SET DEFAULT 'NM';
    ALTER TABLE collection_entries ADD CONSTRAINT collection_entries_condition_check
      CHECK (condition IN ('MT','NM','EX','GD','LP','PL','PO'));
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE collection_entries DROP CONSTRAINT IF EXISTS collection_entries_condition_check;
    ALTER TABLE collection_entries ALTER COLUMN condition DROP DEFAULT;

    UPDATE collection_entries SET condition = CASE condition
      WHEN 'MT' THEN 'NM'
      WHEN 'EX' THEN 'LP'
      WHEN 'GD' THEN 'MP'
      WHEN 'PL' THEN 'HP'
      WHEN 'PO' THEN 'DMG'
      ELSE condition
    END;

    ALTER TABLE collection_entries ALTER COLUMN condition SET DEFAULT 'NM';
    ALTER TABLE collection_entries ADD CONSTRAINT collection_entries_condition_check
      CHECK (condition IN ('NM','LP','MP','HP','DMG'));
  `);
};
