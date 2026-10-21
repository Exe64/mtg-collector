/**
 * Données Commander des cartes (plan #4, « Trouver un commandant »).
 *
 *  - Colonnes remplies par le sync bulk (`mapScryfallCard`) : NULL / false tant
 *    que le bulk n'a pas été rejoué. Ajout purement additif : colonnes nullables
 *    ou à défaut constant → aucune réécriture de table (PostgreSQL ≥ 11).
 *  - Index sur la face avant en minuscules : clé de comparaison de `checkDeck`,
 *    réutilisée pour chiffrer les cartes manquantes d'un deck moyen EDHREC.
 */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE cards
      ADD COLUMN IF NOT EXISTS legal_commander BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS edhrec_rank     INTEGER,
      ADD COLUMN IF NOT EXISTS game_changer    BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS keywords        TEXT[];
  `);
  pgm.sql("CREATE INDEX IF NOT EXISTS idx_cards_front_lower ON cards (lower(split_part(name, ' // ', 1)));");
};

export const down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_cards_front_lower;');
  pgm.sql(`
    ALTER TABLE cards
      DROP COLUMN IF EXISTS keywords,
      DROP COLUMN IF EXISTS game_changer,
      DROP COLUMN IF EXISTS edhrec_rank,
      DROP COLUMN IF EXISTS legal_commander;
  `);
};
