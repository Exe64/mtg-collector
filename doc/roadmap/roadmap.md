# Roadmap Magic Collection Manager

> Backlog actif. L'historique détaillé est archivé dans `_archives/`.
> Dernière mise à jour : 2026-11-16.

## Contexte

Backlog consolidé : plans nommés d'après leur issue GitHub (voir `doc/roadmap/`).
- « À faire » : travaux restants, triés par priorité.
- « Fait » : ce qui a été livré et validé.

---

## À faire

- **[Issue: #32] `#32` — README vitrine et préparation du dépôt public** 🟢 · priorité moyenne · S — README anglais vitrine + README.fr.md, exploitation dans doc/, LICENSE AGPL-3.0, audit léger avant passage en public.
  [`32-readme-vitrine.md`](32-readme-vitrine.md)

- **[Issue: #33] `#33` — Mise à jour depuis l'application** 🟢 · priorité moyenne · L — Release GitHub sur tag, détection dans l'admin, mise à jour en un clic via agent hôte systemd, sauvegarde et rollback automatique. Dépend de #32.
  [`33-mise-a-jour-depuis-app.md`](33-mise-a-jour-depuis-app.md)

- **[Issue: #4] `#4` — Trouver un commandant** 🟢 · priorité moyenne · L — Page « Commandants » façon find-commander de Manamancer : commandants légaux ou légendes de la collection, données EDHREC et Commander Spellbook en cache.
  [`4-trouver-un-commandant.md`](4-trouver-un-commandant.md)

---

## Fait

### Plans livrés (2026-11-16)

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
