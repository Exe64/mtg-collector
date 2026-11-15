---
plan:
  id: '30'
  name: 30-corrections-audit-applicatif.md
  link: https://github.com/Exe64/mtg-collector/blob/main/doc/roadmap/done/30-corrections-audit-applicatif.md
status: done
date: 2026-11-15
description: >
  Corrections et optimisations issues de l'audit applicatif : fiabilité de
  l'inventaire, sécurité des dépendances et du conteneur, validation des
  entrées, performances des jobs et de l'import, tests des mutations.
priority: high
complexity: M
intent: null
depends_on: []
blocks: []
scope:
  modules:
    - backend/src/routes/collection.js
    - backend/src/routes/wishlist.js
    - backend/src/routes/auth.js
    - backend/src/services/priceSync.js
    - backend/src/services/importer.js
    - backend/src/services/collectionLog.js
    - backend/src/services/collection.js
    - backend/src/services/dailyJob.js
    - backend/src/validation/schemas.js
    - backend/test/integration/
    - backend/Dockerfile
    - frontend/nginx.conf
issue:
  id: 30
  url: https://github.com/Exe64/mtg-collector/issues/30
---

# [🛠️] Plan #30 - Corrections de l'audit applicatif

## Objectif

L'audit du 2026-11-15 n'a trouvé rien de cassé (lint propre, tests verts), mais des fragilités qui contredisent le principe « l'inventaire fait foi » et quelques optimisations peu coûteuses. Ce plan les traite par lots, du plus risqué au plus cosmétique.

## Périmètre

### Inclus
- Atomicité du +/- rapide et de son journal
- Mise à jour de `csv-parse` (GHSA-8cw4-87c7-c6xx), conteneur backend en utilisateur non-root
- Journalisation des changements d'emplacement / état / finition (édition unitaire et en masse)
- Validation des `:id` et de `acquired_at` (400 au lieu de 500)
- Synchro prix en lots, résolution d'import en lot
- En-têtes de cache nginx, jobs prix et bulk sérialisés via `startJob`, doublon `requireAdmin`
- Requêtes du tableau de bord fusionnées
- Tests d'intégration des mutations d'inventaire
- Mises à jour mineures des dépendances

### Hors scope
- Mises à jour majeures (React 19, Tailwind 4, ESLint 10, pino 10)
- Agrégation de `card_price_history` : mesurer la taille d'abord, plan séparé si elle le justifie
- Relecture de `export.js`, `admin.js`, `edhrec.js`, `alerts.js` (non audités)

## Étapes

**Lot 1 — Fiabilité et sécurité**
- [x] Étape 1 — `POST /collection/adjust` : upsert unique + journal dans une transaction (même schéma que `undoLogEntry`) (S · standard → Sonnet)
- [x] Étape 2 — `csv-parse` 7, vérifier l'import ManaBox/Moxfield ; `USER node` dans le Dockerfile backend avec `bulk-data` inscriptible (S · standard → Sonnet)
- [x] Étape 3 — Validation : `:id` entier sur les routes collection / wishlist / annulation, `acquired_at` en date zod (XS · standard → Sonnet)
- [x] Étape 4 — Journal : tracer les changements d'emplacement, état, finition (PATCH et bulk) ; nouvelle source `move`, non annulable dans un premier temps (M · reasoning → Opus)
- [x] Étape 5 — Tests d'intégration : adjust (concurrence), patch, bulk avec conflit, annulation, import merge/replace (M · standard → Sonnet)

**Lot 2 — Performances et exploitation**
- [x] Étape 6 — `syncCollectionPrices` via `upsertCardsBatch` ; résolution d'import groupée par `scryfall_id` puis par set + numéro (S · standard → Sonnet)
- [x] Étape 7 — nginx : `Cache-Control: immutable` sur `/assets/`, `no-cache` sur `index.html` et le service worker (XS · standard → Sonnet)
- [x] Étape 8 — Jobs prix et bulk hebdo via `startJob` ; suppression du `requireAdmin` dupliqué dans `routes/auth.js` (XS · standard → Sonnet)
- [x] Étape 9 — `getStats` : fusionner totaux, plus-value et fraîcheur en une requête (S · standard → Sonnet)
- [x] Étape 10 — Mises à jour mineures des dépendances (vite, plugin-react, zustand, lucide, postcss, express-rate-limit, supertest) (XS · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Journal des déplacements | Paire de lignes `move` (−n ancienne variante, +n nouvelle), non annulable, exclue des totaux du jour | PRODUCT.md : « toute modification est tracée ». Confirmé le 2026-11-15. Σ journal = inventaire préservé |
| Transactions | Helper `withTransaction` (db.js) + `applyDelta` partagé par adjust et undo | Une seule implémentation du verrou `FOR UPDATE` + plancher à 0 |
| Tests d'intégration | `node --test --test-concurrency=1` | Les deux fichiers d'intégration vident la même base |
| Concurrence du +/- | Upsert `ON CONFLICT` + `DELETE … WHERE quantity <= 0` en transaction | Pas de verrou applicatif, la contrainte d'unicité fait le travail |
| Majeures de dépendances | Hors plan | Aucune n'est un correctif de sécurité |

## Tests

### Prérequis pour les tests

```bash
# Postgres + Redis jetables (ports isolés, aucun impact sur les conteneurs de prod)
docker run -d --rm --name mtg-it-pg -e POSTGRES_DB=magic_collection -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:16-alpine
docker run -d --rm --name mtg-it-redis -p 127.0.0.1:56379:6379 redis:8-alpine

export DATABASE_URL=postgres://test:test@127.0.0.1:55432/magic_collection
export REDIS_URL=redis://127.0.0.1:56379
export JWT_SECRET=ci-secret-ci-secret-ci-secret-ci-secret
export JWT_REFRESH_SECRET=ci-refresh-ci-refresh-ci-refresh-ci-refresh
export RUN_DB_TESTS=1 NODE_ENV=test
```

### Procédure de test

```bash
# 1. Backend : lint, syntaxe, tests unitaires + intégration (api.test.js, collection.test.js)
cd /srv/dev/mtg-collector/backend
npm ci
npm run lint
find src -name '*.js' -exec node --check {} +
npm run migrate
npm test

# 2. Audit des dépendances de prod
npm audit --omit=dev

# 3. Image backend non-root
docker build -t mtg-backend-test .
docker run --rm --entrypoint sh mtg-backend-test -c 'id -un; touch bulk-data/x && echo bulk-ok; touch src/x || echo src-ro'
docker run -d --rm --name mtg-backend-test --network host -e DATABASE_URL -e REDIS_URL -e JWT_SECRET -e JWT_REFRESH_SECRET -e PORT=33001 mtg-backend-test
curl -s localhost:33001/api/health
docker stop mtg-backend-test

# 4. Frontend : lint, build, en-têtes nginx
cd /srv/dev/mtg-collector/frontend
npm ci && npm run lint && npm run build
docker build -t mtg-front-test .
docker run -d --rm --name mtg-front-test --add-host backend:127.0.0.1 -p 127.0.0.1:38080:80 mtg-front-test
curl -sI localhost:38080/ | grep -i cache-control
curl -sI localhost:38080/sw.js | grep -i cache-control
curl -sI "localhost:38080$(curl -s localhost:38080/ | grep -o '/assets/[^"]*\.js' | head -1)" | grep -i cache-control
docker stop mtg-front-test

# 5. Nettoyage
docker stop mtg-it-pg mtg-it-redis
```

**Résultats attendus :**
- Lint backend et frontend sans erreur, `node --check` silencieux.
- `npm test` : 49 tests, 0 échec (sans `RUN_DB_TESTS` : 20 passés, 2 suites ignorées).
- `npm audit --omit=dev` : plus d'alerte `csv-parse` ; restent 3 alertes modérées `glob`/`minimatch` via `node-pg-migrate` (outil de migration, hors scope).
- Image backend : `node`, `bulk-ok`, `src` en lecture seule, `/api/health` → `{"status":"ok","db":"up","redis":"up"}`.
- nginx : `no-cache` sur `/` et `/sw.js`, `public, max-age=31536000, immutable` sur `/assets/*`, en-têtes de sécurité toujours présents.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-15 | Étape 1 — 10 × `adjust +1` concurrents | quantité 10, Σ journal 10 | 10 / 10 (ancien code : 5) | ✅ PASS |
| 2026-11-15 | Étape 1 — 4 × `adjust -3` concurrents sur 10 | quantité 0, Σ journal 0 | 0 / 0 (ancien code : 2) | ✅ PASS |
| 2026-11-15 | Étape 1 — `adjust -1` sur variante absente | 0, aucune ligne de journal | conforme | ✅ PASS |
| 2026-11-15 | Étape 2 — `csv-parse` 7 : BOM, guillemets, lignes vides, colonnes en trop | parse identique à v5 | identique ; `npm audit` : alerte csv-parse levée | ✅ PASS |
| 2026-11-15 | Étape 2 — image backend non-root | `id` = node, `bulk-data` inscriptible, `src` en lecture seule, migrations + `/api/health` OK | conforme | ✅ PASS |
| 2026-11-15 | Étape 3 — `:id` non entier (patch, delete, undo, wishlist) | 400 | 400 ×4 | ✅ PASS |
| 2026-11-15 | Étape 3 — `acquired_at` `hier` / `2026-01-31` / `null` | 400 / 200 / 200 | conforme | ✅ PASS |
| 2026-11-15 | Étape 4 — PATCH emplacement ; état + quantité ; notes seules | paire move ; move + edit ; rien | conforme, Σ journal = inventaire | ✅ PASS |
| 2026-11-15 | Étape 4 — PATCH vers variante existante | 409, rien journalisé | conforme | ✅ PASS |
| 2026-11-15 | Étape 4/5 — bulk sans puis avec conflit | {2,0} puis {1,1}, Σ journal = inventaire | conforme | ✅ PASS |
| 2026-11-15 | Étape 4 — `move` dans `/log` | variante exposée, `undoable: false`, undo → 400 | conforme | ✅ PASS |
| 2026-11-15 | Étape 5 — undo adjust, double undo, id inconnu | -2 appliqué, 409, 404 | conforme | ✅ PASS |
| 2026-11-15 | Étape 5 — import merge (ManaBox) puis replace (Moxfield) | qté 4 puis 3, Σ journal = inventaire | conforme | ✅ PASS |
| 2026-11-15 | Étape 6 — import : Scryfall ID + set/n° groupés, repli au nom, dry-run | 1 local / 1 Scryfall / 1 invalide | conforme | ✅ PASS |
| 2026-11-15 | Étape 6 — `syncCollectionPrices` via `upsertResilient` (fetch simulé) | prix MAJ + historique du jour pour chaque carte suivie | conforme | ✅ PASS |
| 2026-11-15 | Étape 7 — en-têtes nginx (image construite) | `/`, `/sw.js`, manifest, route SPA : no-cache ; `/assets/*` : immutable ; sécurité conservée | conforme | ✅ PASS |
| 2026-11-15 | Étape 8 — `startJob` : 2ᵉ lancement pendant un run ; job en échec | refusé ; erreur journalisée + état `ok: false` | conforme | ✅ PASS |
| 2026-11-15 | Étape 8 — `/api/auth/users` (requireAdmin partagé) | admin 200, non-admin 403 | conforme | ✅ PASS |
| 2026-11-15 | Étape 9 — `getStats` avant/après fusion (jeu de données fixe) | sortie JSON identique | identique octet pour octet, 2 requêtes de moins | ✅ PASS |
| 2026-11-15 | Étape 10 — mises à jour mineures (eslint, express-rate-limit, supertest ; plugin-react, lucide, postcss, vite, zustand) | lint, tests, build OK | conforme | ✅ PASS |
| 2026-11-15 | 🧪 Tests finaux — procédure complète ci-dessus | voir résultats attendus | 49/49, lint ×2 OK, build OK, audit : 3 modérées node-pg-migrate | ✅ PASS |

## Journal de session

### Session 2026-11-15
- ✅ Fait : audit, proposition validée, plan et issue #30 créés
- 📋 Prochain : étape 1

### Session 2026-11-15 (implémentation one-shot)
- ✅ Fait : étapes 1 à 10 + 🧪 Tests (mode autonomous, auto-check inline)
- ℹ️ Étape 10 : vite / plugin-react / express-rate-limit déjà montés en majeure par Exe64/infra-vps#15 ; seuls les patchs restants ont été appliqués
- ℹ️ Hors scope relevé : `frontend/scripts/gen-icons.mjs` (`Buffer` non défini pour ESLint, hors du script `lint`), alertes `glob`/`minimatch` via `node-pg-migrate`
- ✅ Validation : résultats de la section Tests revus, tous PASS ; commits ef0a4b4 → 62c1a68 poussés sur main ; plan clôturé, issue #30 fermée
