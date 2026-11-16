---
plan:
  id: '35'
  name: 35-suggestions-restent-ouvertes.md
  link: https://github.com/Exe64/mtg-collector/blob/main/doc/roadmap/35-suggestions-restent-ouvertes.md
status: in-progress
date: 2026-11-16
updated_at: 2026-11-16
description: >
  Les suggestions d'autocomplétion de la page « Ajouter des cartes » se
  rouvrent après validation de la recherche (Entrée ou clic sur une suggestion).
priority: medium
complexity: XS
intent: null
issue: https://github.com/Exe64/mtg-collector/issues/35
---

# #35 — Suggestions qui restent ouvertes après la recherche

## Cause

`frontend/src/pages/Add.jsx` : l'effet d'autocomplétion (debounce 250 ms)
appelle `setShowSug(true)` à chaque réponse. `runSearch` ferme la liste, puis
la requête en attente la rouvre. Au clic sur une suggestion, `setQ(c.name)`
relance l'effet, qui la rouvre aussi.

## Étapes

- [x] Ouvrir la liste uniquement sur saisie (`onChange`), plus dans l'effet.
- [ ] 🧪 Tests
- [ ] ✅ Validation

## Tests

| # | Procédure | Attendu | Résultat |
|---|---|---|---|
| 1 | `npm run build` (frontend) | Build OK | ✅ build + eslint OK |
| 2 | Taper « Lightning Bolt » puis Entrée tout de suite | Résultats affichés, liste fermée | — (manuel) |
| 3 | Taper « Light », cliquer une suggestion | Liste fermée, versions affichées | — (manuel) |
| 4 | Retaper dans le champ | La liste se rouvre | — (manuel) |
