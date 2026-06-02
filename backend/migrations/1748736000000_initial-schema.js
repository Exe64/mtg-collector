/* eslint-disable camelcase */

/**
 * Schéma initial — Magic Collection Manager
 *
 * Intègre les arbitrages de la revue de spec :
 *  - #5  finish VARCHAR(10) (nonfoil/foil/etched) au lieu de foil BOOLEAN
 *  - #1  card_price_history + collection_set_snapshots (courbes carte/édition/collection)
 *  - #6  cards.card_faces JSONB (donnée DFC préservée)
 *  - #7  cards.scryfall_id sert de cible d'upsert (lazy upsert à l'ajout)
 *  - idx_entries_card (recherche inverse pour la sync prix)
 *  - set_code élargi à 16, totaux en NUMERIC(12,2)
 *
 * Exécuté automatiquement au démarrage du backend via `npm run migrate up`.
 */

export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    -- =====================================================================
    -- Utilisateurs
    -- =====================================================================
    CREATE TABLE users (
      id            SERIAL PRIMARY KEY,
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name  VARCHAR(100),
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      last_login    TIMESTAMPTZ
    );

    -- =====================================================================
    -- Cache global des extensions Scryfall
    -- =====================================================================
    CREATE TABLE sets (
      code         VARCHAR(16) PRIMARY KEY,
      name         VARCHAR(255) NOT NULL,
      released_at  DATE,
      card_count   INTEGER,
      icon_uri     TEXT,
      set_type     VARCHAR(50),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    );

    -- =====================================================================
    -- Cache global des cartes Scryfall (alimenté par bulk-data + lazy upsert)
    -- =====================================================================
    CREATE TABLE cards (
      id                SERIAL PRIMARY KEY,
      scryfall_id       UUID UNIQUE NOT NULL,
      oracle_id         UUID,
      name              VARCHAR(500) NOT NULL,
      set_code          VARCHAR(16) REFERENCES sets(code),
      set_name          VARCHAR(255),
      collector_number  VARCHAR(20),
      image_uri         TEXT,
      image_uri_small   TEXT,
      card_faces        JSONB,              -- faces recto/verso (DFC/MDFC/split/adventure)
      colors            TEXT[],
      color_identity    TEXT[],
      type_line         TEXT,
      oracle_text       TEXT,
      mana_cost         VARCHAR(100),
      rarity            VARCHAR(20),
      finishes          TEXT[],             -- finitions dispo selon Scryfall
      prices_eur        NUMERIC(10,2),
      prices_eur_foil   NUMERIC(10,2),
      prices_eur_etched NUMERIC(10,2),
      prices_usd        NUMERIC(10,2),
      prices_usd_foil   NUMERIC(10,2),
      prices_raw        JSONB,
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX idx_cards_name   ON cards(name);
    CREATE INDEX idx_cards_set    ON cards(set_code);
    CREATE INDEX idx_cards_oracle ON cards(oracle_id);

    -- =====================================================================
    -- Collection de chaque utilisateur
    -- =====================================================================
    CREATE TABLE collection_entries (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
      card_id         INTEGER REFERENCES cards(id),
      quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      finish          VARCHAR(10) NOT NULL DEFAULT 'nonfoil'
                      CHECK (finish IN ('nonfoil','foil','etched')),
      condition       VARCHAR(5) DEFAULT 'NM'
                      CHECK (condition IN ('NM','LP','MP','HP','DMG')),
      language        VARCHAR(5) DEFAULT 'en',
      acquired_price  NUMERIC(10,2),
      acquired_at     DATE,
      notes           TEXT,
      added_at        TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, card_id, finish, condition, language)
    );
    CREATE INDEX idx_entries_user ON collection_entries(user_id);
    CREATE INDEX idx_entries_card ON collection_entries(card_id);

    -- =====================================================================
    -- Historique de prix par carte (courbe carte / sparkline)
    -- Limité aux cartes présentes dans ≥1 collection.
    -- =====================================================================
    CREATE TABLE card_price_history (
      card_id        INTEGER REFERENCES cards(id) ON DELETE CASCADE,
      snapshot_date  DATE NOT NULL,
      eur            NUMERIC(10,2),
      eur_foil       NUMERIC(10,2),
      eur_etched     NUMERIC(10,2),
      usd            NUMERIC(10,2),
      usd_foil       NUMERIC(10,2),
      PRIMARY KEY (card_id, snapshot_date)
    );

    -- =====================================================================
    -- Snapshot quotidien de la valeur globale de collection (courbe collection)
    -- =====================================================================
    CREATE TABLE collection_snapshots (
      id                SERIAL PRIMARY KEY,
      user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
      total_value_eur   NUMERIC(12,2),
      total_value_usd   NUMERIC(12,2),
      card_count        INTEGER,
      unique_card_count INTEGER,
      snapshot_date     DATE NOT NULL,
      UNIQUE (user_id, snapshot_date)
    );

    -- =====================================================================
    -- Snapshot quotidien par édition (courbe édition)
    -- =====================================================================
    CREATE TABLE collection_set_snapshots (
      user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
      set_code          VARCHAR(16) REFERENCES sets(code),
      snapshot_date     DATE NOT NULL,
      total_value_eur   NUMERIC(12,2),
      total_value_usd   NUMERIC(12,2),
      card_count        INTEGER,
      unique_card_count INTEGER,
      PRIMARY KEY (user_id, set_code, snapshot_date)
    );

    -- =====================================================================
    -- Refresh tokens (allowlist en base pour révocation ; le token réel
    -- circule en cookie httpOnly SameSite=Strict, jamais en JSON)
    -- =====================================================================
    CREATE TABLE refresh_tokens (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token_hash  VARCHAR(255) UNIQUE NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS refresh_tokens;
    DROP TABLE IF EXISTS collection_set_snapshots;
    DROP TABLE IF EXISTS collection_snapshots;
    DROP TABLE IF EXISTS card_price_history;
    DROP TABLE IF EXISTS collection_entries;
    DROP TABLE IF EXISTS cards;
    DROP TABLE IF EXISTS sets;
    DROP TABLE IF EXISTS users;
  `);
};
