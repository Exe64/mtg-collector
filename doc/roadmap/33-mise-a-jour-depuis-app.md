---
plan:
  id: '33'
  name: 33-mise-a-jour-depuis-app.md
  link: https://github.com/Exe64/mtg-collector/blob/main/doc/roadmap/33-mise-a-jour-depuis-app.md
status: active
date: 2026-11-15
description: >
  Détecter une nouvelle release GitHub et mettre l'instance à jour en un clic
  depuis l'administration, via un agent hôte systemd (sans socket Docker) avec
  sauvegarde préalable et rollback automatique.
priority: medium
complexity: L
intent: null
depends_on: ['32']
scope:
  modules:
    - backend/package.json
    - frontend/package.json
    - backend/Dockerfile
    - frontend/Dockerfile
    - docker-compose.yml
    - .github/workflows/release.yml
    - backend/src/services/
    - backend/src/routes/admin.js
    - frontend/src/pages/
    - deploy/updater/
    - doc/updating.md
issue:
  id: 33
  url: https://github.com/Exe64/mtg-collector/issues/33
---

# [⬆️] Plan #33 - Mise à jour de l'instance depuis l'application

## Objectif

Quand une nouvelle version est publiée (GitHub Release `vX.Y.Z`), l'admin d'une
instance le voit dans l'application, lit les notes de version et déclenche la
mise à jour en un clic. Un agent hôte l'applique de façon sûre : sauvegarde,
build, healthcheck, rollback automatique en cas d'échec.

## Périmètre

### Inclus
- Versioning unique (`package.json`) + `APP_VERSION` injecté au build, exposé
  par `/api/health` et l'admin ; script `npm run release -- <patch|minor|major>`.
- Workflow `release.yml` : push d'un tag `v*` → GitHub Release avec notes générées.
- Service backend de détection (API `releases/latest`, cache Redis, token
  optionnel) branché sur le job quotidien + route admin « Vérifier ».
- Protocole backend ↔ agent par dossier hôte monté (`request.json` / `status.json`),
  verrou anti double demande.
- Agent hôte `deploy/updater/` : script + unités systemd `.path` / `.service` ;
  backup → checkout du tag → `compose up --build` → healthcheck ; échec →
  tag précédent + restauration du dump → `rolled_back`.
- UI admin : carte Version, notes de version, bouton « Mettre à jour » avec
  confirmation, suivi du statut, badge admin « mise à jour disponible ».
- `doc/updating.md`, `API.md`, lien depuis le README (#32).

### Hors scope
- Images GHCR, Watchtower, accès du backend au socket Docker.
- Choix d'une version arbitraire, mise à jour vers `main`, pré-releases.
- Mise à jour automatique sans clic.
- Repo privé `deployment-scripts` (seule la commande d'installation de l'agent est fournie).

## Étapes

**Lot 1 — détection seule**
- [x] Étape 1 — Versioning : version unique, `npm run release`, `APP_VERSION` build arg exposé par `/api/health` et l'admin (S · standard → Sonnet)
- [x] Étape 2 — Workflow `release.yml` : tag `v*` → GitHub Release, notes générées (S · standard → Sonnet)
- [x] Étape 3 — Service backend `updates` : `releases/latest` (cache Redis, token optionnel), comparaison semver, job quotidien + route admin « Vérifier » (M · standard → Sonnet)

**Lot 2 — mise à jour en un clic**
- [ ] Étape 4 — Protocole backend ↔ agent : dossier monté `/updates` (`request.json` / `status.json`), verrou, routes admin demander / suivre (M · reasoning → Opus)
- [ ] Étape 5 — Agent hôte `deploy/updater/` : script + systemd `.path`/`.service`, backup → checkout tag → build → healthcheck → statut, rollback auto (L · reasoning → Opus)
- [ ] Étape 6 — UI admin : carte Version, notes rendues, bouton + confirmation, statut live, badge admin (M · standard → Sonnet)

**Lot 3 — doc et tests**
- [ ] Étape 7 — `doc/updating.md` (installation agent, sécurité, rollback, mode manuel), `API.md`, lien README (S · standard → Sonnet)
- [ ] Étape 8 — Tests unitaires/intégration (semver, cache, verrou, cycle request/status, routes admin) + dry-run de l'agent avec faux `docker compose` (M · standard → Sonnet)
- [ ] 🧪 Tests — E2E sur instance locale : tag de test, mise à jour réussie, puis échec simulé → rollback
- [ ] ✅ Validation — Vérifier les résultats des tests et clôturer

> Note 2026-11-16 : l'agent de l'étape 5 réutilise `deploy/backup-db.sh` pour
> la sauvegarde avant mise à jour.

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Source des versions | GitHub Releases (`releases/latest`), dépôt public | Pas de token requis ; token optionnel conservé |
| Création d'une release | Push d'un tag `v*` → workflow, notes auto | Commits sur `main`, Conventional Commits déjà en place |
| Mécanisme de mise à jour | Agent hôte systemd, échange par dossier partagé | Le backend n'a jamais le socket Docker (= root hôte) |
| Cible | Dernière release stable uniquement | Instances sur des tags, jamais `main` |
| Sécurité | Backup avant + rollback auto (tag précédent + restauration du dump) | Les migrations ne se défont pas seules |
| Fréquence | Job quotidien + bouton « Vérifier » | Suffisant, peu d'appels API |
| Notification | Admins uniquement | Seuls eux peuvent agir |
| Première release | `v1.0.0` publiée en fin de Lot 1 ; l'agent mémorise `git rev-parse HEAD` pour le rollback | Aucun tag existant, instances actuellement sur `main` |
| Cohérence des données | `compose stop backend` avant le backup (coupure ~1–3 min) | Aucune écriture perdue entre dump et rollback |
| Dump à restaurer | `backup-db.sh` émet `BACKUP_FILE=<chemin>` en dernière ligne | L'agent sait quel dump restaurer, cron inchangé |
| Entrée de l'agent | `request.json` = `{"action":"update"}` seul ; l'agent résout lui-même le dernier tag et vérifie son existence | Aucune valeur du backend n'atteint le shell root |
| Tests E2E | Dépôt bare local + tags de test + faux `docker compose` | Rien n'est poussé sur GitHub |
| `/api/health` | Ajout d'un champ `version` uniquement | Healthcheck compose inchangé |

## Tests

### Prérequis pour les tests

```bash
cd /srv/dev/mtg-collector
# Postgres + Redis jetables pour les tests d'intégration
docker run -d --rm --name mtg33-pg -e POSTGRES_DB=magic_collection -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:16-alpine
docker run -d --rm --name mtg33-redis -p 127.0.0.1:56379:6379 redis:8-alpine
export DATABASE_URL=postgres://test:test@127.0.0.1:55432/magic_collection REDIS_URL=redis://127.0.0.1:56379 RUN_DB_TESTS=1 NODE_ENV=test JWT_SECRET=ci-secret-ci-secret-ci-secret-ci-secret JWT_REFRESH_SECRET=ci-refresh-ci-refresh-ci-refresh-ci-refresh
SCRATCH=/tmp/claude-1000/-srv-dev-mtg-collector/4310bd5d-c88a-4f67-8810-6e483bb48910/scratchpad
```

### Procédure de test

**Étape 1 — Versioning**

```bash
# T1.1 lint + tests backend (unitaires + intégration health/admin version)
cd /srv/dev/mtg-collector/backend && npm run migrate && npm run lint && npm test
# T1.2 build frontend (ligne Version dans Administration)
cd /srv/dev/mtg-collector/frontend && npx eslint src/pages/Accounts.jsx && npx vite build
# T1.3 script de release sur un clone jetable
rm -rf $SCRATCH/rel && git clone -q /srv/dev/mtg-collector $SCRATCH/rel
cp /srv/dev/mtg-collector/{package.json,deploy/release.sh} ... # (copie des fichiers non commités)
cd $SCRATCH/rel && npm run release -- minor && git tag && grep '"version"' backend/package.json frontend/package.json
npm run release -- bogus      # refusé
echo x >> README.md && npm run release -- patch   # refusé (arbre sale)
# + branche ≠ main, main ≠ origin/main, tag déjà existant → refusés
```

**Étape 2 — Workflow `release.yml`**

```bash
# T2.1 lint du workflow
docker run --rm -v /srv/dev/mtg-collector:/repo:ro -w /repo --entrypoint /usr/local/bin/actionlint rhysd/actionlint:1.7.7 .github/workflows/release.yml
# T2.2 déclencheur + permissions
python3 -c "import yaml;d=yaml.safe_load(open('.github/workflows/release.yml'));print(d[True], d['permissions'])"
# T2.3 garde tag ↔ package.json : extraire le `run` de l'étape « Tag must match… » et l'exécuter
GITHUB_REF_NAME=v1.0.0 bash guard.sh   # code 0
GITHUB_REF_NAME=v9.9.9 bash guard.sh   # code 1 + ::error::
# T2.4 `gh release create --verify-tag --generate-notes` avec GH_TOKEN=github.token
# T2.5 (live, fin du Lot 1) : push du tag v1.0.0 → release publiée
```

**Résultats attendus (étape 2) :** actionlint muet ; push de tags `v*.*.*` uniquement, `contents: write` ; garde OK / refus ; release créée au push du tag.

**Étape 3 — Service `updates`**

```bash
cd /srv/dev/mtg-collector/backend
# T3.1 lint + tests (semver ; intégration : release détectée, cache, égalité, 404, erreur cachée 10 min + dernière release conservée, job en échec, 401)
npm run lint && npm test
# T3.2 appel réel GitHub sans token (dépôt public)
REDIS_URL=redis://127.0.0.1:56379 node -e "import('./src/services/updates.js').then(async m=>{console.log(JSON.stringify(await m.getUpdateStatus({force:true})));process.exit(0)})"
# T3.4 Redis indisponible → pas d'erreur 500, cache ignoré
REDIS_URL=redis://127.0.0.1:1 node -e "import('./src/services/updates.js').then(async m=>{console.log(JSON.stringify(await m.getUpdateStatus()));process.exit(0)})"
```

**Résultats attendus (étape 3) :** 0 échec ; T3.2 → `current: "1.0.0"`, `latest: null` tant qu'aucune release n'existe, sans `error`.

**Résultats attendus (étape 1) :**
- T1.1 : lint propre, 0 échec ; `/api/health` et `/api/admin/status` renvoient `version` au format semver.
- T1.2 : lint propre, build OK.
- T1.3 : commit `chore(release): v1.1.0` + tag `v1.1.0`, versions back/front et lockfiles à `1.1.0` ; argument invalide → usage ; arbre sale → `working tree not clean`.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-16 | T1.1 lint + tests backend | 0 échec, health/admin exposent `version` | 55/55 pass, sous-tests health/admin `ok` | ✅ |
| 2026-11-16 | T1.2 build frontend | lint + build OK | OK | ✅ |
| 2026-11-16 | T1.3 release script | tag + versions à jour ; refus usage / arbre sale / hors main | `v1.0.1` créé, 4 fichiers à 1.0.1 ; 3 refus code 1 | ✅ |
| 2026-11-16 | T1.3b release script (après revue) | refus si tag existe ou main ≠ origin | refusés, arbre restauré ; OK une fois synchronisé | ✅ |
| 2026-11-16 | T1.4 override `APP_VERSION` | `1.0.0` puis `9.9.9-test` | idem | ✅ |
| 2026-11-16 | T2.1 actionlint | aucune erreur | exit 0, muet (auto-check : le Vérificateur n'a pas pu lancer docker, permission refusée) | ✅ |
| 2026-11-16 | T2.2 déclencheur / permissions | tags `v*.*.*`, `contents: write` | idem | ✅ |
| 2026-11-16 | T2.3 garde de version | v1.0.0 → 0 ; v9.9.9 → 1 + `::error::` | idem | ✅ |
| 2026-11-16 | T2.4 création de la release | `--verify-tag --generate-notes`, `github.token` | présent | ✅ |
| 2026-11-16 | T3.1 lint + tests | 0 échec, tests semver/updates `ok` | 59/59 pass | ✅ |
| 2026-11-16 | T3.2 GitHub réel sans token | `latest: null`, pas d'`error` | idem (dépôt public, aucune release) | ✅ |
| 2026-11-16 | T3.3 variables compose / .env.example | `UPDATES_REPO`, `UPDATES_GITHUB_TOKEN` | présentes | ✅ |
| 2026-11-16 | T3.1b après revue (erreur cachée 10 min, dernière release conservée, job en échec, limiter) | 0 échec | 59/59 pass | ✅ |
| 2026-11-16 | T3.4 Redis indisponible | pas d'exception | statut renvoyé | ✅ |
| — | T2.5 release live | release `v1.0.0` publiée | à jouer en fin de Lot 1 | ⏳ |

## Journal de session

### Session 2026-11-15
- ✅ Fait : cadrage (agent hôte, release sur tag, rollback auto), issue #33, plan créé.
- 📋 Prochain : Phase 6 (validation avant implémentation, plan L), puis étape 1.

### Session 2026-11-16
- ✅ Phase 6 validée (grilling : 6 décisions ajoutées). Implémentation démarrée.
- ✅ Étape 1 : version lue depuis `backend/package.json` (override `APP_VERSION` env — pas de build arg, YAGNI), `npm run release`, `version` dans health/admin. Vérificateur PASS.
- ✅ Étape 2 : `release.yml` (tag `v*.*.*` → garde version → `gh release create --generate-notes`). T2.5 live reportée en fin de Lot 1.
- ⚠️ Dépôt GitHub privé → décision : **dépôt rendu public** (option A), token optionnel conservé.
- ✅ Étape 3 : service `updates` + cron 06:15 UTC + routes admin `GET /updates`, `POST /updates/check` (limiter 10/h). Revue : cache best-effort, erreur cachée 10 min, job en échec visible. Vérificateur PASS.
