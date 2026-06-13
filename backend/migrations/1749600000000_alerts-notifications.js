/**
 * Alertes de prix + notifications in-app, et enrichissement du journal :
 *  - price_alerts : seuil € par carte (below/above), one-shot (désactivée une
 *    fois déclenchée, réarmable), évaluée par le job quotidien après la MAJ prix.
 *  - notifications : cloche in-app (alerte déclenchée, résumé de spikes…).
 *  - collection_log : variante complète (condition/langue/emplacement) pour
 *    pouvoir annuler un mouvement, + undone_at (anti double-annulation).
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS price_alerts (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
      card_id        INTEGER REFERENCES cards(id) ON DELETE CASCADE,
      direction      VARCHAR(5) NOT NULL CHECK (direction IN ('below','above')),
      threshold_eur  NUMERIC(10,2) NOT NULL CHECK (threshold_eur > 0),
      active         BOOLEAN NOT NULL DEFAULT TRUE,
      triggered_at   TIMESTAMPTZ,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, card_id, direction)
    );
    CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(card_id) WHERE active;

    CREATE TABLE IF NOT EXISTS notifications (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      card_id     INTEGER REFERENCES cards(id) ON DELETE CASCADE,
      type        VARCHAR(20) NOT NULL,
      message     TEXT NOT NULL,
      read_at     TIMESTAMPTZ,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

    ALTER TABLE collection_log
      ADD COLUMN IF NOT EXISTS condition VARCHAR(5),
      ADD COLUMN IF NOT EXISTS language  VARCHAR(5),
      ADD COLUMN IF NOT EXISTS location  VARCHAR(100),
      ADD COLUMN IF NOT EXISTS undone_at TIMESTAMPTZ;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE collection_log
      DROP COLUMN IF EXISTS condition,
      DROP COLUMN IF EXISTS language,
      DROP COLUMN IF EXISTS location,
      DROP COLUMN IF EXISTS undone_at;
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS price_alerts;
  `);
};
