---
plan:
  id: '34'
  name: 34-alertes-dependabot.md
  link: https://github.com/Exe64/mtg-collector/blob/main/doc/roadmap/done/34-alertes-dependabot.md
status: done
date: 2026-11-16
updated_at: 2026-11-16
description: >
  Corriger les 11 alertes Dependabot ouvertes sur des dépendances de dev
  transitives (brace-expansion, glob, minimatch, deepmerge).
priority: high
complexity: S
intent: null
scope:
  modules:
    - backend/package.json
    - backend/package-lock.json
    - frontend/package.json
    - frontend/package-lock.json
issue:
  id: 34
  url: https://github.com/Exe64/mtg-collector/issues/34
---

# [🔒] Plan #34 - Alertes Dependabot

## Objectif

Fermer les 11 alertes Dependabot ouvertes, toutes sur des dépendances
transitives d'outillage (migrations, build PWA).

## Périmètre

### Inclus
| Paquet | Version | Chemin | Alertes | Correctif |
|---|---|---|---|---|
| brace-expansion | 1.1.15 | backend (minimatch 3) | #4 #8 #9 #20 #22 #24 | 1.1.22 via `npm audit fix` (remplace PR #26) |
| glob | 13.0.7 / 11.1.0 | node-pg-migrate / workbox-build | #29 #83 | override `^14.0.2` |
| minimatch | 10.2.6 | imbriqué dans glob | #30 #84 | 11.x, apporté par glob 14 |
| deepmerge | 4.3.1 | @rollup/plugin-node-resolve | #82 | aucun correctif publié → alerte ignorée (build seulement) |

### Hors scope
- Montées de version majeures de node-pg-migrate / vite-plugin-pwa.

## Étapes

- [x] Étape 1 — Backend : override glob, `npm audit fix` (XS · standard → Sonnet)
- [x] Étape 2 — Frontend : override glob (XS · standard → Sonnet)
- [x] 🧪 Tests — `npm audit`, tests backend, migrations, build frontend + service worker
- [x] ✅ Validation — Fermer PR #26, ignorer l'alerte deepmerge, clôturer

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| glob/minimatch | `overrides` npm | Pas de version amont corrigée de node-pg-migrate / workbox-build ; `audit fix --force` rétrograderait |
| deepmerge | Ignorer l'alerte | Aucune version corrigée ; utilisé uniquement au build par rollup |

## Tests

### Prérequis pour les tests

```bash
cd /srv/dev/mtg-collector
```

### Procédure de test

```bash
# Postgres + Redis jetables (même procédure que le plan #30)
docker run -d --rm --name mtg-it-pg -e POSTGRES_DB=magic_collection -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:16-alpine
docker run -d --rm --name mtg-it-redis -p 127.0.0.1:56379:6379 redis:8-alpine
export DATABASE_URL=postgres://test:test@127.0.0.1:55432/magic_collection REDIS_URL=redis://127.0.0.1:56379
export JWT_SECRET=ci-secret-ci-secret-ci-secret-ci-secret JWT_REFRESH_SECRET=ci-refresh-ci-refresh-ci-refresh-ci-refresh RUN_DB_TESTS=1 NODE_ENV=test

cd /srv/dev/mtg-collector/backend
npm ci && npm audit && npm run migrate && npm test && npm run lint
cd ../frontend
npm ci && npm audit; npm run build && npm test
docker stop mtg-it-pg mtg-it-redis
```

**Résultats attendus :** backend 0 vulnérabilité ; frontend uniquement deepmerge (low) ;
migrations appliquées (node-pg-migrate découvre les fichiers via glob 14) ; tests OK ;
build PWA avec précache non vide (workbox-build via glob 14).

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-16 | `npm audit` backend | 0 vulnérabilité | 0 (glob 14.0.6, minimatch 11.0.8, brace-expansion 1.1.22) | ✅ |
| 2026-11-16 | `npm audit` frontend | deepmerge seul | 4 low, toutes via deepmerge 4.3.1 | ✅ |
| 2026-11-16 | Migrations sur base vierge | 24 migrations UP | 24 UP, relance « No migrations to run » | ✅ |
| 2026-11-16 | `npm test` backend (DB) + lint | 0 échec | 54/54, lint OK | ✅ |
| 2026-11-16 | Build frontend PWA | sw.js + précache | 87 entrées précachées, `dist/sw.js` généré | ✅ |
| 2026-11-16 | `npm test` frontend | 0 échec | 12/12 | ✅ |

## Journal de session

### Session 2026-11-16
- ✅ Fait : analyse des 11 alertes, issue #34, plan créé. Override `glob: ^14.0.2`
  backend + frontend, `npm audit fix` backend (brace-expansion 1.1.22). Tests au vert.
- ✅ Validation : tests au vert, `main` poussé, alerte deepmerge #82 ignorée (pas de correctif amont), issue #34 fermée. Plan clos.
