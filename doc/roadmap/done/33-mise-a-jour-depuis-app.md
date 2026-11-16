---
plan:
  id: '33'
  name: 33-mise-a-jour-depuis-app.md
  link: https://github.com/Exe64/mtg-collector/blob/main/doc/roadmap/done/33-mise-a-jour-depuis-app.md
status: done
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
- [x] Étape 4 — Protocole backend ↔ agent : dossier monté `/updates` (`request.json` / `status.json`), verrou, routes admin demander / suivre (M · reasoning → Opus)
- [x] Étape 5 — Agent hôte `deploy/updater/` : script + systemd `.path`/`.service`, backup → checkout tag → build → healthcheck → statut, rollback auto (L · reasoning → Opus)
- [x] Étape 6 — UI admin : carte Version, notes rendues, bouton + confirmation, statut live, badge admin (M · standard → Sonnet)

**Lot 3 — doc et tests**
- [x] Étape 7 — `doc/updating.md` (installation agent, sécurité, rollback, mode manuel), `API.md`, lien README (S · standard → Sonnet)
- [x] Étape 8 — Tests unitaires/intégration (semver, cache, verrou, cycle request/status, routes admin) + dry-run de l'agent avec faux `docker compose` (M · standard → Sonnet)
- [x] 🧪 Tests — E2E sur instance locale : tag de test, mise à jour réussie, puis échec simulé → rollback
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer

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
| Entrée de l'agent | `requests/request.json` jamais lu par l'agent (contient `action`, `requestedBy`, `requestedAt` à titre informatif) ; l'agent résout lui-même le plus haut tag `vX.Y.Z` | Aucune valeur du backend n'atteint le shell root |
| Isolation des fichiers | `updates/` root (755) : `status.json`, `update.log` ; seul `updates/requests/` est inscriptible par le backend (uid 1000) | Pas de symlink planté suivi par l'agent root |
| Git côté agent | Commandes git via `runuser -u <propriétaire du dépôt>` | Root sur dépôt d'un autre utilisateur = « dubious ownership » + fichiers root |
| Tests E2E | Dépôt bare local + tags de test + faux `docker compose` | Rien n'est poussé sur GitHub |
| `/api/health` | Ajout d'un champ `version` uniquement | Healthcheck compose inchangé |
| Lancement de l'agent | `ExecStart=/bin/bash <script>` | SELinux : systemd ne peut exécuter un script étiqueté contenu utilisateur |
| E2E | Instance séparée (projet `mtge2e`, port 8033) au lieu de l'instance locale | Ne pas détacher le HEAD du dépôt de dev ni arrêter l'instance principale |

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

**Étape 4 — Protocole backend ↔ agent**

```bash
cd /srv/dev/mtg-collector/backend
# T4.1 intégration : demande déposée (requests/request.json, sans cible), verrou 409, statut/log agent,
#      statut périmé non bloquant, refus sans mise à jour, 503 explicite sans dossier agent
npx eslint src test && npm test
# T4.2 montage /updates (rw) dans le service backend
cd /srv/dev/mtg-collector && docker compose config | grep -B2 -A3 "target: /updates"
# T4.3 dossier d'échange ignoré par git
git check-ignore -v updates/x
```

**Résultats attendus (étape 4) :** 0 échec ; montage rw ; règle `updates/` appliquée.

**Étape 5 — Agent hôte**

```bash
cd /srv/dev/mtg-collector
# T5.0 lint shell
docker run --rm -v "$PWD":/mnt:ro -w /mnt koalaman/shellcheck:v0.10.0 deploy/updater/*.sh deploy/release.sh
# T5.1–T5.14 dry-run : remote git jetable (v1.0.0/1.1.0/1.2.0), faux docker compose, fausse sauvegarde
./deploy/updater/test-updater.sh
```

**Résultats attendus (étape 5) :** shellcheck muet ; `ALL PASS` — succès (plus haut tag stable), rollback (code + DROP/CREATE + dump rejoué), échec du rollback → `failed` + intervention manuelle, échec sauvegarde → rien modifié, déjà à jour → aucune action, modifications locales → refus, symlink planté → refus, contenu de la demande ignoré, script réécrit par le checkout sans casser le run, erreur git ≠ « propre », demande-dossier supprimée, SIGTERM → rollback, root sans `SUDO_UID` sur dépôt d'un autre utilisateur → succès sans fichier root.

**Étape 6 — UI admin**

```bash
cd /srv/dev/mtg-collector/frontend
# T6.1 lint + build
./node_modules/.bin/eslint src vite.config.js && npx vite build
# T6.2–T6.4 navigateur réel (Playwright dans mcr.microsoft.com/playwright:v1.58.2-noble, --network host)
#   backend local :3001 sur la base jetable, APP_VERSION=0.9.0 (release réelle v1.0.0 détectée),
#   UPDATES_DIR=$SCRATCH/upd ; Vite :5173 ; compte admin@test.io
#   shot.cjs  : pastille menu, carte + notes, confirmation, demande déposée, en cours, rollback, mobile
#   shot2.cjs : page ouverte backend arrêté → carte minimale + reconnexion auto ; retour en 1.1.0 → carte rafraîchie + « Recharger »
```

**Résultats attendus (étape 6) :** lint/build OK ; pastille dorée sur « Outils » (et « Plus » en mobile) ; carte Version (installée / dernière / vérifier), notes rendues ; confirmation mentionnant sauvegarde, 1–3 min d'indisponibilité, restauration auto ; `request.json` sans cible ; bandeau d'étape ; résultat `rolled_back` + journal ; mobile sans débordement ; backend arrêté → carte minimale qui se reconnecte, puis versions rafraîchies et invitation à recharger.

**Étape 7 — Documentation**

```bash
cd /srv/dev/mtg-collector
# T7.1 liens relatifs + ancres (doc/updating.md, README*, backend/API.md, doc/operations.md)
python3 $SCRATCH/verify-links.py
# T7.2 doc/updating.md référencé
grep -n "updating.md" README.md README.fr.md doc/operations.md backend/API.md
```

**Étape 8 — Tests en CI**

```bash
# T8.1 lint du workflow CI (job `updater` : shellcheck + test-updater.sh)
docker run --rm -v "$PWD":/repo:ro -w /repo --entrypoint /usr/local/bin/actionlint rhysd/actionlint:1.7.7 .github/workflows/ci.yml
# T8.3 dry-run de l'agent dans un environnement git vierge (comme un runner)
HOME=$SCRATCH/vhome GIT_CONFIG_NOSYSTEM=1 ./deploy/updater/test-updater.sh
```

**Résultats attendus (étapes 7–8) :** 0 lien cassé ; actionlint muet ; `ALL PASS`.

**🧪 Tests finaux — E2E sur instance séparée (agent systemd réel, SELinux enforcing)**

```bash
# Instance jetable : clone dans /tmp/mtg-updater-e2e (MTG_E2E_DIR), projet compose mtge2e, 127.0.0.1:8033,
# remote git local avec tags de test (v0.8.0 → v0.9.0 avec migration, v0.9.1 migration cassée),
# sauvegardes chiffrées, agent installé par install.sh. L'instance principale (:80) n'est pas touchée.
./deploy/updater/e2e-updater.sh            # A : mise à jour via POST /admin/updates/apply → succeeded
                           # B : v0.9.1 cassée → rolled_back (code + base recréée + données restaurées)
                           # C : double demande → 409
./deploy/updater/e2e-updater.sh cleanup    # désinstalle l'agent, supprime l'instance
```

**Résultats attendus (🧪) :** `E2E ALL PASS` ; instance principale intacte ; nettoyage complet.

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
| 2026-11-16 | T4.1 lint + intégration protocole | 0 échec | 61/61 pass (Vérificateur) | ✅ |
| 2026-11-16 | T4.2 montage `/updates` | rw sur le backend | `${MTG_UPDATES_DIR:-./updates}:/updates`, pas de `read_only` | ✅ |
| 2026-11-16 | T4.3 `.gitignore` | `updates/` ignoré | `.gitignore:9:updates/` | ✅ |
| 2026-11-16 | T5.0–T5.10 (1ʳᵉ version) | shellcheck muet, ALL PASS | idem (Vérificateur, 13/13) | ✅ |
| 2026-11-16 | T5.0–T5.14 après revue (git en tant que propriétaire, SIGTERM, demande-dossier, guard git) | ALL PASS | ALL PASS ; contrôles négatifs : sans `runuser` → T5.14 ❌ (dubious ownership), sans copie privée → inutile (git remplace l'inode) | ✅ |
| 2026-11-16 | T6.1 lint + build | OK | OK (Vérificateur) | ✅ |
| 2026-11-16 | T6.2 parcours navigateur | confirmation, demande sans cible, pas de débordement | conformes (Vérificateur) | ✅ |
| 2026-11-16 | T6.3 captures (menu, carte, en cours, rollback, mobile) | conformes | conformes (Vérificateur) | ✅ |
| 2026-11-16 | T6.4 après revue : backend arrêté à l'ouverture, retour en 1.1.0 | carte minimale + reconnexion, versions rafraîchies, « Recharger » | conformes | ✅ |
| 2026-11-16 | T7.1 liens / T7.2 références | 0 lien cassé, 4 références | 51/51 liens OK, 4 références (Vérificateur) ; 52/52 après révision | ✅ |
| 2026-11-16 | T8.1–T8.3 CI `updater` | actionlint muet, ALL PASS en git vierge | conformes (Vérificateur) | ✅ |
| 2026-11-16 | T5.15 + revue doc (checkout refusé sans rollback, `skipped`, `available` = `requests/`) | ALL PASS, 61/61 | conformes | ✅ |
| 2026-11-16 | 🧪 E2E run 1 | agent déclenché | ❌ `203/EXEC Permission denied` : SELinux interdit à systemd d'exécuter un script `user_tmp_t` → `ExecStart=/bin/bash <script>` | ❌ |
| 2026-11-16 | 🧪 E2E run 2 (A/B/C) | ALL PASS | 22/22 ✅ : A succeeded 0.8.0→0.9.0, B rolled_back (oid base changé, données restaurées), C 409 | ✅ |
| 2026-11-16 | 🧪 E2E rejoué par le Vérificateur + non-régression + nettoyage | ALL PASS, instance :80 intacte, 0 unité / 0 conteneur résiduel | 19/19 ✅, log preflight→stop→backup→checkout→build→rollback, 4 conteneurs `mtg-collector-*` Up, nettoyage complet | ✅ |
| 2026-11-16 | 🧪 `deploy/updater/e2e-updater.sh` (version commitée) | ALL PASS | ALL PASS, nettoyage OK | ✅ |
| 2026-11-16 | T2.5 release live | release `v1.0.0` publiée, détectée | workflow OK, release stable, `releases/latest` = v1.0.0 ; instance 1.0.0 à jour, 0.9.0 → mise à jour proposée | ✅ |

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
- ✅ Release `v1.0.0` publiée (fin du Lot 1).
- ✅ Étape 4 : `updateAgent.js`, routes `GET /updates/progress`, `POST /updates/apply`, montage `/updates`. Revue : dossier root + `requests/`, `running` écrit avant consommation, cible retirée de la demande. Vérificateur PASS.
- ✅ Étape 5 : `deploy/updater/` (agent, unités systemd, `install.sh`, `test-updater.sh`), `BACKUP_FILE=` dans `backup-db.sh`. Revue : git en tant que propriétaire, trap TERM, `rm -rf` de la demande, guard git. Vérificateur PASS.
- ✅ Étape 6 : `UpdateCard` (version, notes, mise à jour, suivi, journal), pastille admin, `__APP_VERSION__` (Vite). Revue : polling quand backend injoignable, rafraîchissement en fin de run, fin de suivi sur `requestedAt` serveur, rechargement via le service worker, région live permanente. Vérificateur PASS.
- ✅ Étape 7 : `doc/updating.md` + liens README/operations/API/.env.example. Revue d'exactitude doc ↔ code : 15 écarts corrigés (HEAD détachée, cible = plus haut tag du remote, variables de sauvegarde dans `.env`, droits du dossier de sauvegarde, demande orpheline…), dont 3 dans le code (checkout refusé sans rollback, état `skipped`, `available` = `requests/`).
- ✅ Étape 8 : job CI `updater` (shellcheck + dry-run). Les tests unitaires/intégration prévus existent déjà (étapes 3–5).
- ✅ 🧪 E2E : 1ᵉʳ run ❌ (SELinux : exec refusé → unité via `/bin/bash`), 2ᵉ run 22/22 ✅, rejoué par le Vérificateur (PASS), script commité `deploy/updater/e2e-updater.sh`.
- ✅ Validation : toutes les étapes et les tests (unitaires, intégration, dry-run agent, navigateur, E2E systemd) vérifiés au PASS par le Vérificateur ; plan clôturé, issue #33 fermée.
