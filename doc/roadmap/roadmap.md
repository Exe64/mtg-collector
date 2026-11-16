# Roadmap Magic Collection Manager

> Backlog actif. L'historique détaillé est archivé dans `_archives/`.
> Dernière mise à jour : 2026-11-17.

## Contexte

Backlog consolidé : plans nommés d'après leur issue GitHub (voir `doc/roadmap/`).
- « À faire » : travaux restants, triés par priorité.
- « Fait » : ce qui a été livré et validé.

---

## À faire

---

## Fait

- **[Issue: #4] `#4` — Trouver un commandant** (2026-11-16) 🔵 — Page « Commandants » façon find-commander de Manamancer : catalogue légal filtrable (classement EDHREC), Ma collection (% du deck moyen possédé et coût pour compléter), thèmes et typal, Matchmaker, présélection et comparaison ; fiche en page dédiée avec decklist complète, variantes EDHREC (thème, Budget / Cher, niveaux 1-5), combos Commander Spellbook ; possession par carte, toutes éditions. Cache EDHREC / Spellbook en base (7 j).
  [`4-trouver-un-commandant.md`](done/4-trouver-un-commandant.md)

- **[Issue: #39] `#39` — Decks : filtrer et grouper par format** (2026-11-16) 🔵 — Page Decks : une section par format (ordre alphabétique) et un filtre par format mémorisé dans l'URL (`?format=`) (v1.2.0).
  [`39-decks-filtre-format.md`](done/39-decks-filtre-format.md)

- **[Issue: #37] `#37` — Pied de page copyright et encart dons** (2026-11-16) 🔵 — Footer © Julien DUMUR / GitHub / Ko-fi / version / licence sur toutes les pages, encart « Soutenir le projet » avec boutons Ko-fi et PayPal à logos dans l'administration (v1.1.0 → v1.1.3).
  [`37-footer-copyright-dons.md`](done/37-footer-copyright-dons.md)

### Plans livrés (2026-11-16)

- **[Issue: #38] `#38` — Agent de mise à jour : fichiers compose de la stack en cours** (2026-11-16) 🔵 — L'agent reprend les fichiers compose des conteneurs en cours (label `config_files`), refuse avant tout arrêt si incohérent, et cite la vraie erreur de `docker compose` dans le statut. Suite de l'incident VPS (port 80 / `docker-compose.vps.yml` ignoré).
  [`38-agent-fichiers-compose.md`](done/38-agent-fichiers-compose.md)

- **[Issue: #33] `#33` — Mise à jour depuis l'application** (2026-11-16) 🔵 — Version unique + `npm run release`, release GitHub sur tag `vX.Y.Z` (v1.0.0 publiée), détection quotidienne dans l'admin, mise à jour en un clic via agent hôte systemd (sauvegarde, checkout du tag, rebuild, rollback automatique code + base), suivi live, doc `updating.md`, E2E systemd/SELinux.
  [`33-mise-a-jour-depuis-app.md`](done/33-mise-a-jour-depuis-app.md)

- **[Issue: #32] `#32` — README vitrine et préparation du dépôt public** (2026-11-17) 🔵 — README anglais vitrine + README.fr.md avec captures, guides installation / exploitation / sauvegardes dans doc/, LICENSE AGPL-3.0, SECURITY.md, CONTRIBUTING.md, audit gitleaks propre.
  [`32-readme-vitrine.md`](done/32-readme-vitrine.md)

- **[Issue: #35] `#35` — Suggestions qui restent ouvertes après la recherche** (2026-11-16) 🔵 — La liste d'autocomplétion de « Ajouter des cartes » ne s'ouvre plus que sur saisie, plus après Entrée ou clic sur une suggestion.
  [`35-suggestions-restent-ouvertes.md`](done/35-suggestions-restent-ouvertes.md)

- **[Issue: #36] `#36` — Codes de secours MFA** (2026-11-16) 🔵 — Codes de secours acceptés à la désactivation et à la connexion (`verifyTotp` ne lève plus sur un code non numérique) ; téléchargement .txt des codes après activation.
  [`36-mfa-codes-secours.md`](done/36-mfa-codes-secours.md)

- **[Issue: #34] `#34` — Alertes Dependabot** (2026-11-16) 🔵 — Override `glob` ^14.0.2 (backend + frontend, minimatch 11 inclus), brace-expansion 1.1.22 ; alerte deepmerge ignorée (aucun correctif publié, build seulement).
  [`34-alertes-dependabot.md`](done/34-alertes-dependabot.md)

### Plans livrés (2026-11-15)

- **[Issue: #31] `#31` — Gestion des decks** (2026-11-15) 🔵 — Decks comparés à la collection, impression possédée sinon la moins chère (ou l'édition et la finition de la liste importée), légalité par format et règles Commander, statistiques, image de fond, CCM et prix par ligne ; « Construire avec » et « Vérif deck » branchés.
  [`31-gestion-des-decks.md`](done/31-gestion-des-decks.md)

- **[Issue: #30] `#30` — Corrections de l'audit applicatif** (2026-11-15) 🔵 — +/- rapide, PATCH et édition en masse transactionnels ; déplacements journalisés ; csv-parse 7 et conteneur non-root ; validation des `:id` et dates ; synchro prix et import en lot ; cache nginx ; jobs sérialisés ; tests d'intégration des mutations.
  [`30-corrections-audit-applicatif.md`](done/30-corrections-audit-applicatif.md)

### Plans livrés (2026-10-05 → 2026-10-20)

- **[Issue: #3] `#3` — Refonte visuelle inspirée de Manamancer** (2026-10-20) 🔵 — Zinc chaud et sable doré, titres Cormorant SC, barre fine en verre, hero « MTG Collector » à fonds rotatifs tirés de la collection, tuiles illustrées, connexion « dans l'espace », largeur uniforme ; route `GET /api/collection/hero-arts`.
  [`3-refonte-visuelle-manamancer.md`](done/3-refonte-visuelle-manamancer.md)

- **[Issue: #2] `#2` — Corrections de l'audit d'interface** (2026-10-05) 🔵 — Contraste, focus, modales natives, étiquettes, cibles tactiles, couleurs des graphiques et chargement par route du frontend.
  [`2-corrections-audit-interface.md`](done/2-corrections-audit-interface.md)

---

## Archivé
