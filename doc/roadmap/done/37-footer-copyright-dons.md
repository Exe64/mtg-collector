---
plan:
  id: '37'
  name: 37-footer-copyright-dons.md
  link: https://github.com/Exe64/mtg-collector/blob/main/doc/roadmap/done/37-footer-copyright-dons.md
status: done
date: 2026-11-16
updated_at: 2026-11-16
description: >
  Pied de page copyright sur toutes les pages (GitHub, Ko-fi, version, licence)
  et encart « Soutenir le projet » (Ko-fi, PayPal) dans l'administration.
priority: low
complexity: S
intent: null
issue: https://github.com/Exe64/mtg-collector/issues/37
---

# #37 — Pied de page copyright et encart dons

## Étapes

- [x] `frontend/src/components/ui/Footer.jsx` : © Julien DUMUR · GitHub · Offrez-moi un café (Ko-fi) · version · licence AGPL · mention non officielle ; liens centralisés dans `constants.js`.
- [x] Footer branché dans `Layout.jsx` (pages connectées) et `AuthShell.jsx` (connexion / inscription).
- [x] `frontend/src/components/admin/SupportCard.jsx` : encart dons (Ko-fi, PayPal) en tête de `Accounts.jsx` ; boutons à droite du texte avec logos Ko-fi / PayPal (`public/brands/`).
- [x] 🧪 Tests
- [x] ✅ Validation

## Tests

| # | Procédure | Attendu | Résultat |
|---|---|---|---|
| 1 | `npm run build` + `npm run lint` (frontend) | OK | ✅ lint + build OK |
| 2 | Pages connectées (desktop + mobile) | Footer visible, non masqué par la barre basse mobile | ✅ validé par l’utilisateur |
| 3 | `/login`, `/register` | Footer visible | ✅ validé par l’utilisateur |
| 4 | Administration | Encart dons, boutons Ko-fi / PayPal à droite du texte, côte à côte, avec logos | ✅ validé par l’utilisateur (v1.1.3) |
