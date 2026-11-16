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
- [ ] Étape 1 — Versioning : version unique, `npm run release`, `APP_VERSION` build arg exposé par `/api/health` et l'admin (S · standard → Sonnet)
- [ ] Étape 2 — Workflow `release.yml` : tag `v*` → GitHub Release, notes générées (S · standard → Sonnet)
- [ ] Étape 3 — Service backend `updates` : `releases/latest` (cache Redis, token optionnel), comparaison semver, job quotidien + route admin « Vérifier » (M · standard → Sonnet)

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

## Tests

### Prérequis pour les tests

```bash
cd /srv/dev/mtg-collector
```

### Procédure de test

```bash
(à rédiger à l'étape 🧪 Tests)
```

**Résultats attendus :** à définir.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|

## Journal de session

### Session 2026-11-15
- ✅ Fait : cadrage (agent hôte, release sur tag, rollback auto), issue #33, plan créé.
- 📋 Prochain : Phase 6 (validation avant implémentation, plan L), puis étape 1.
