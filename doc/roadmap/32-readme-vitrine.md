---
plan:
  id: '32'
  name: 32-readme-vitrine.md
  link: https://github.com/Exe64/mtg-collector/blob/main/doc/roadmap/32-readme-vitrine.md
status: active
date: 2026-11-15
description: >
  README vitrine en anglais (+ README.fr.md), exploitation déplacée dans doc/,
  LICENSE AGPL-3.0 et audit léger avant le passage du dépôt en public.
priority: medium
complexity: S
intent: null
blocks: ['33']
scope:
  modules:
    - README.md
    - README.fr.md
    - doc/
    - LICENSE
    - SECURITY.md
    - CONTRIBUTING.md
    - .gitignore
issue:
  id: 32
  url: https://github.com/Exe64/mtg-collector/issues/32
---

# [📘] Plan #32 - README vitrine et préparation du dépôt public

## Objectif

Donner au dépôt un README qui fasse « pro » pour un public d'inconnus qui
découvre et auto-héberge MTG Collector, et préparer le passage du dépôt en
public (le passage lui-même reste une action de l'utilisateur).

## Périmètre

### Inclus
- `README.md` anglais vitrine + `README.fr.md` (lien croisé en tête).
- Déplacement du contenu d'exploitation dans `doc/installation.md`,
  `doc/operations.md`, `doc/backups.md`.
- `LICENSE` (AGPL-3.0), `SECURITY.md`, `CONTRIBUTING.md` courts.
- Audit léger : gitleaks sur l'historique, `backups/` au `.gitignore`,
  données perso dans fixtures/tests.
- Intégration des captures fournies par l'utilisateur dans `doc/assets/screenshots/`.

### Hors scope
- Passer le dépôt en public (action utilisateur).
- Site de documentation (MkDocs, Docusaurus…).
- `doc/updating.md` (livré par #33).

## Captures d'écran à fournir

PNG ~1440×900, thème sombre, données réelles, dans `doc/assets/screenshots/` :

| # | Fichier | Écran | Contenu à montrer |
|---|---|---|---|
| 1 | `hero.png` | Accueil / Tableau de bord | Vue d'ensemble (valeur, courbe, donuts) — capture héros |
| 2 | `collection.png` | Collection | Filtres ouverts + groupement par extension |
| 3 | `add.png` | Ajouter | Recherche avec plusieurs éditions et −/+ |
| 4 | `card-modal.png` | Détail carte | Image HD, oracle, prix, rulings |
| 5 | `commanders.png` | Commandants | Grille filtrée + % « Ma collection » |
| 6 | `commander-detail.png` | Fiche commandant | Combos, cartes phares |
| 7 | `deck-detail.png` | Détail deck | Stats + decklist 3 colonnes, image de fond |
| 8 | `set-detail.png` | Détail extension | Complétion + manquantes |
| 9 | `movements.png` | Mouvements de prix | Hausses / baisses |
| 10 | `admin.png` | Administration | État système + actions (e-mails des comptes masqués) |
| 11 | `mobile.png` | Mobile (PWA) | Une page en 390×844 |

Optionnel : `banner.png` (1280×320). Sinon : bannière texte.

## Étapes

- [ ] Étape 1 — Audit avant passage en public : gitleaks historique, `backups/` au `.gitignore`, données perso dans fixtures/tests (S · standard → Sonnet)
- [ ] Étape 2 — `LICENSE` AGPL-3.0, `SECURITY.md`, `CONTRIBUTING.md` courts (XS · standard → Sonnet)
- [ ] Étape 3 — Déplacer l'exploitation vers `doc/installation.md`, `doc/operations.md`, `doc/backups.md` (S · standard → Sonnet)
- [ ] Étape 4 — `README.md` anglais vitrine : bannière, badges, pitch, héros, fonctionnalités + captures, quick start, stack, architecture, liens doc (M · standard → Sonnet)
- [ ] Étape 5 — `README.fr.md` traduction fidèle + liens croisés (S · standard → Sonnet)
- [ ] Étape 6 — Intégrer les captures fournies (alt text), vérifier rendu clair/sombre (XS · standard → Sonnet)
- [ ] 🧪 Tests — Liens relatifs valides, images présentes, rendu GitHub (`gh markdown`), gitleaks propre
- [ ] ✅ Validation — Vérifier les résultats des tests et clôturer

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Public visé | Auto-hébergeurs inconnus, dépôt public | Réponse de cadrage |
| Langue | `README.md` anglais + `README.fr.md` | Norme GitHub, version FR conservée |
| Structure | README vitrine court, exploitation dans `doc/` | Lisibilité, README pro |
| Licence | AGPL-3.0 | App web auto-hébergeable : modifications servies doivent être publiées |
| Captures | Fournies par l'utilisateur | Données réelles, contrôle sur ce qui est exposé |

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
- ✅ Fait : cadrage (diffusion publique, EN + FR, vitrine + doc/, AGPL-3.0, audit léger), issue #32, plan créé.
- 📋 Prochain : étape 1.
