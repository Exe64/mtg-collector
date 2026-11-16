---
plan:
  id: '38'
  name: 38-agent-fichiers-compose.md
  link: https://github.com/Exe64/mtg-collector/blob/main/doc/roadmap/done/38-agent-fichiers-compose.md
status: done
date: 2026-11-16
updated_at: 2026-11-16
description: >
  L'agent de mise à jour réutilise les fichiers compose de la stack en cours et affiche la vraie erreur de docker compose
complexity: S
priority: haute
issue:
  id: 38
  link: https://github.com/Exe64/mtg-collector/issues/38
depends_on: [33]
---

# #38 — Agent de mise à jour : fichiers compose de la stack en cours

## Incident (VPS, 2026-11-16)

Stack démarrée avec `docker-compose.yml` + `docker-compose.vps.yml` (Traefik, pas de port publié), sans `COMPOSE_FILE` dans `.env`. L'agent a lancé `docker compose up` avec `docker-compose.yml` seul : le frontend a voulu prendre le port 80 (Traefik) → échec, rollback en échec pour la même raison → app en 404 jusqu'au redémarrage manuel. Données intactes (sauvegarde après arrêt du backend, restaurée). Statut peu parlant : « étape « build » en échec (code 1) ».

## Étapes

- [x] Agent : sans `COMPOSE_FILE`, reprendre les fichiers du label `com.docker.compose.project.config_files` des conteneurs ; refus en préparation (avant tout arrêt) si conteneurs incohérents, fichier absent ou `COMPOSE_FILE` explicite différent.
- [x] Agent : message de statut avec la dernière erreur de `docker compose up` (mise à jour et rollback).
- [x] Tests `test-updater.sh` (T5.16+) + doc `doc/updating.md`.
- [x] 🧪 Tests
- [x] ✅ Validation (utilisateur, 2026-11-16 : « ça fonctionne parfaitement »)

## Tests

| # | Procédure | Attendu | Résultat |
|---|---|---|---|
| 1 | `./deploy/updater/test-updater.sh` | ALL PASS, T5.1–T5.15 inchangés | ✅ ALL PASS (T5.1–T5.22, T5.14 en root via sudo) |
| 2 | T5.16 sans `COMPOSE_FILE`, label à 2 fichiers | succès ; chaque appel compose et la sauvegarde reçoivent les 2 fichiers | ✅ |
| 3 | T5.17 / T5.18 / T5.19 labels incohérents, fichier absent, `COMPOSE_FILE` différent | `failed` en preflight, backend jamais arrêté, code inchangé | ✅ |
| 4 | T5.20 `COMPOSE_FILE` relatif identique | succès, `COMPOSE_FILE` non réécrit | ✅ |
| 5 | T5.21 `up` en échec « port is already allocated » (mise à jour puis rollback) | erreur citée dans le statut | ✅ |
| 6 | T5.22 dossier via lien symbolique ; `COMPOSE_PATH_SEPARATOR=;` dans `.env` | chemins du label exportés tels quels ; pas de faux refus | ✅ |
| 7 | Contre-tests (vérificateur + T5.22) : chaque garde retirée sur une copie | le test correspondant échoue | ✅ 8 mutants, tous détectés |
| 8 | Docker réel (projet jetable base + override) : `ps -aq` avec le seul fichier de base, label, `COMPOSE_FILE` à virgules | conteneurs de l'override vus, chemins absolus, `config --services` complet | ✅ |
| 9 | shellcheck `deploy/release.sh deploy/updater/*.sh` | aucun avertissement | ✅ |
| 10 | Revue adversariale | — | 2 défauts (realpath → autre projet compose via symlink ; séparateur de `.env` ignoré) corrigés, couverts par T5.22 |
| 11 | Sur le VPS : prochaine mise à jour depuis l'admin | `succeeded`, frontend joignable via Traefik | ⏳ reporté : premier run réel de l'agent corrigé à la prochaine release (VPS sain, `COMPOSE_FILE` désormais dans `.env`) |
