---
plan:
  id: '36'
  name: 36-mfa-codes-secours.md
  link: https://github.com/Exe64/mtg-collector/blob/main/doc/roadmap/done/36-mfa-codes-secours.md
status: done
date: 2026-11-16
updated_at: 2026-11-16
description: >
  Codes de secours MFA refusés (désactivation et connexion) ; ajout du
  téléchargement des codes en .txt après activation.
priority: high
complexity: S
intent: null
issue: https://github.com/Exe64/mtg-collector/issues/36
---

# #36 — Codes de secours MFA

## Cause

`backend/src/services/mfa.js` : `verifyTotp` appelle `otplib.verify`, qui lève
`Token must be 6 digits` sur un code de secours `xxxx-xxxx`. L'exception part
dans `next(err)` avant `consumeBackupCode`. Touche `/mfa/disable` et `/login`.

## Étapes

- [x] `verifyTotp` renvoie `false` si le code n'est pas 6 chiffres (corrige les deux routes).
- [x] Test unitaire : code de secours passé à `verifyTotp` → `false`, sans exception.
- [x] `Security.jsx` : bouton « Télécharger (.txt) » sur l'encart des codes de secours.
- [x] 🧪 Tests
- [x] ✅ Validation

## Tests

| # | Procédure | Attendu | Résultat |
|---|---|---|---|
| 1 | `node --test test/mfa.test.js` (backend) | Tests MFA verts | ✅ 2/2 |
| 2 | `npm run build` (frontend) | Build OK | ✅ build + eslint OK |
| 3 | Activer le MFA, cliquer « Télécharger (.txt) » | Fichier `mtg-collector-codes-secours.txt` avec les 10 codes | ✅ validé par l’utilisateur |
| 4 | Désactiver le MFA avec un code de secours | MFA désactivé | ✅ validé par l’utilisateur |
| 5 | Connexion avec un code de secours | Connecté, compteur de codes −1 | ✅ validé par l’utilisateur |
