/**
 * Ajoute le coût de mana converti (cmc / mana value) aux cartes, pour permettre
 * le filtrage par coût. Rempli au prochain sync (bulk ou job quotidien) et au
 * lazy upsert. Les cartes déjà en base ont cmc = NULL jusqu'à un re-sync.
 */
export const up = (pgm) => {
  pgm.sql('ALTER TABLE cards ADD COLUMN IF NOT EXISTS cmc NUMERIC(6,2);');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE cards DROP COLUMN IF EXISTS cmc;');
};
