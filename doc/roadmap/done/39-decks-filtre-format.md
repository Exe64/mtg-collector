---
plan:
  id: '39'
  name: 39-decks-filtre-format.md
  link: https://github.com/Exe64/mtg-collector/blob/main/doc/roadmap/done/39-decks-filtre-format.md
status: done
date: 2026-11-16
updated_at: 2026-11-16
description: >
  Page Decks : decks groupés par format (sections alphabétiques) et filtre
  par format mémorisé dans l'URL (?format=).
priority: medium
complexity: S
intent: null
scope:
  modules:
    - frontend/src/pages/Decks.jsx
    - frontend/src/components/decks/logic.js
issue:
  id: 39
  url: https://github.com/Exe64/mtg-collector/issues/39
---

# [🗂️] Plan #39 - Decks : filtrer et grouper par format

## Objectif

Sur la page Decks, regrouper les decks par format et pouvoir n'afficher qu'un format, avec un choix conservé dans l'URL.

## Périmètre

### Inclus
- `frontend/src/components/decks/logic.js` : helper pur `groupByFormat` + test dans `logic.test.js`.
- `frontend/src/pages/Decks.jsx` : sélecteur de format, sections par format, `?format=` via `useSearchParams`.

### Hors scope
- Backend / API (`/decks` renvoie déjà `format`).
- Autres tris (nom, date) ; l'ordre intra-format reste celui de l'API (`updated_at DESC`).

## Étapes

- [x] Étape 1 — `groupByFormat(decks)` → `[[format, decks]]` trié alphabétiquement par `formatLabel`, ordre intra-groupe conservé ; test unitaire (XS · standard → Sonnet)
- [x] Étape 2 — `Decks.jsx` : `?format=` (useSearchParams), sélecteur visible si ≥ 2 formats (formats présents uniquement), sections « Format (n) » avec titre masqué s'il ne reste qu'une section, valeur d'URL inconnue → « tous » (S · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test (avant-dernière étape, obligatoire)
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer (dernière étape, obligatoire)

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Comportement | Filtrer + grouper | Choix utilisateur (cadrage Q1) |
| Persistance | Paramètre d'URL `?format=` | Survit au rechargement/retour, partageable (Q2) |
| Ordre des sections | Alphabétique par libellé | Choix utilisateur (Q3) |
| Section unique | Titre masqué, grille simple | Pas de titre redondant (Q4) |
| Côté | Frontend uniquement | Les données sont déjà renvoyées par l'API |

## Tests

### Prérequis pour les tests

```bash
cd /srv/dev/mtg-collector/frontend
```

### Procédure de test

```bash
# T1 — tests unitaires (dont groupByFormat)
npm test
# T2 — build de production
npm run build
# T3 — lint des fichiers modifiés
npx eslint src/pages/Decks.jsx src/components/decks/logic.js
```

T4 — contrôle visuel (après rebuild du frontend, `docker compose up -d --build frontend`), page `/decks` :
1. Decks dans ≥ 2 formats → sélecteur « Tous les formats (n) » + une section par format, titre « Format (n) », ordre alphabétique des libellés.
2. Choisir « Modern » → URL `/decks?format=modern`, seule la grille Modern, sans titre ; recharger la page → filtre conservé.
3. Revenir à « Tous les formats » → paramètre retiré de l'URL.
4. Ouvrir `/decks?format=inexistant` → tous les formats affichés, sélecteur sur « Tous ».
5. Compte avec un seul format → ni sélecteur ni titre (grille comme avant).

**Résultats attendus :** T1 13/13 verts ; T2 sortie 0, « built in » ; T3 aucune erreur ; T4 points 1 à 5 conformes.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-16 | Étape 1 — `npm test` (auto-check) | 13/13 | 13/13 | ✅ PASS |
| 2026-11-16 | T1 `npm test` (vérificateur sous-agent) | 13 tests, 0 fail, groupByFormat ok | 13/13, `ok 13 - groupByFormat…` | ✅ PASS |
| 2026-11-16 | T2 `npm run build` (vérificateur) | sortie 0, « built in » | sortie 0, `built in 1.97s`, 0 « error » | ✅ PASS |
| 2026-11-16 | T3 eslint (vérificateur) | sortie 0, aucune erreur | sortie 0, aucune sortie | ✅ PASS |
| 2026-11-16 | T4 contrôle visuel | points 1 à 5 | non joué (conteneur non reconstruit) | ⏳ En attente |
| 2026-11-16 | T4 contrôle visuel (opérateur, v1.2.0) | points 1 à 5 | 1 à 5 confirmés conformes | ✅ PASS |

## Journal de session

### Session 2026-11-16
- ✅ Fait : cadrage (filtrer + grouper, URL, alphabétique, titre masqué si section unique), issue #39, plan créé.
- ✅ Fait : étapes 1 et 2 (groupByFormat + test, Decks.jsx sélecteur/sections/URL), T1–T3 PASS.
- ✅ Fait : release v1.2.0, T4 validé par l'opérateur (points 1 à 5). Plan clôturé.
