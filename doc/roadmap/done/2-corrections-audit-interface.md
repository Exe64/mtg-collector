---
plan:
  id: '2'
  name: 2-corrections-audit-interface.md
  link: https://github.com/Exe64/mtg-collector/blob/main/doc/roadmap/done/2-corrections-audit-interface.md
status: done
date: 2026-10-05
enriched: 2026-10-05
description: >
  Appliquer les corrections de l'audit technique du frontend : contraste, focus,
  modales, étiquettes, cibles tactiles, couleurs des graphiques, chargement.
priority: medium
complexity: M
intent: null
scope:
  modules:
    - frontend/tailwind.config.js
    - frontend/src/
    - DESIGN.md
  patterns:
    - "frontend/src/**/*.jsx"
issue:
  id: 2
  url: https://github.com/Exe64/mtg-collector/issues/2
---

# [♿] Plan #2 - Corrections de l'audit d'interface

## Objectif

Faire passer l'interface au niveau AA sur le contraste et le clavier, la rendre
confortable au doigt sur téléphone et remettre la palette d'équerre, sans changer
son identité visuelle (voir `DESIGN.md`). Audit de départ : 12/20.

## Périmètre

### Inclus
- `frontend/tailwind.config.js`, `frontend/src/index.css`
- Composants et pages de `frontend/src/`
- `DESIGN.md` et `.impeccable/design.json` (teintes corrigées)

### Hors scope
- Backend
- Navigation mobile (les 7 onglets + Plus restent tels quels)
- Bannière et `banner.png` (aucun outil de conversion d'image disponible)
- Renommage des classes `indigo` / `emerald`

## Étapes

- [x] Étape 1 — Palette : nuance du texte discret, libellé sombre sur les boutons ambre, nuances manquantes `gold-950` / `emerald-700` / `emerald-950` (S · standard → Sonnet)
- [x] Étape 2 — Focus et champs : anneau `focus-visible` commun, bordure de champ visible, 16 px sur mobile (S · standard → Sonnet)
- [x] Étape 3 — Modales : modale carte, modale d'édition et feuille « Plus » sur `<dialog>` natif (M · standard → Sonnet)
- [x] Étape 4 — Étiquettes : `aria-label` sur les champs sans étiquette, texte alternatif des graphiques, `aria-sort` sur les en-têtes triables (S · standard → Sonnet)
- [x] Étape 5 — Cibles tactiles : boutons éditer / supprimer / fermer à 44 px sur mobile (S · standard → Sonnet)
- [x] Étape 6 — Couleurs des graphiques : une seule source pour mana, rareté, type et état (S · standard → Sonnet)
- [x] Étape 7 — Chargement : pages chargées à la demande par route, `loading="lazy"` sur les vignettes (S · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test (avant-dernière étape, obligatoire)
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer (dernière étape, obligatoire)

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Bouton ambre | Ambre inchangé, libellé anthracite | Garde la teinte ; le contraste passe de 3,0:1 à plus de 5:1 |
| Onglets mobiles | 7 + Plus conservés | Choix du propriétaire : tout reste à un appui |
| Champs sur mobile | 16 px sous 640 px, 14 px au-delà | Supprime le zoom automatique de Safari iOS |
| Bannière | Non touchée | Pas d'outil de conversion d'image sur la machine |
| Modales | Élément natif `<dialog>` | Piège et retour de focus, Échap et rôle fournis par le navigateur, sans dépendance |

## Tests

### Prérequis pour les tests

```bash
echo "=== Go To Frontend And Install Dependencies ==="
cd /srv/dev/mtg-collector/frontend
npm ci --no-audit --no-fund
```

Node et npm sont requis. Branche : `fix/2-corrections-audit-interface`.

### Procédure de test

```bash
echo "=== T1 Lint ==="
cd /srv/dev/mtg-collector/frontend && npm run lint

echo "=== T2 Production Build ==="
cd /srv/dev/mtg-collector/frontend && npm run build

echo "=== T3 Palette Contrast Check ==="
cd /srv/dev/mtg-collector/frontend && npm run -s check:contrast

echo "=== T4 Page Chunks Emitted By Route Splitting ==="
ls /srv/dev/mtg-collector/frontend/dist/assets | grep -cE "^(Collection|Add|Dashboard|Sets|SetDetail|ImportExport|Wishlist|DeckCheck|Movements|Journal|Alerts|Accounts|Security|Register)-.*[.]js$"

echo "=== T5 Previously Missing Shades Now Generated ==="
grep -oE "[.](bg-gold-950|bg-emerald-950|border-emerald-700|text-gold-200|border-edge)" /srv/dev/mtg-collector/frontend/dist/assets/index-*.css | sort -u | wc -l

echo "=== T6 Images Without Lazy Loading ==="
grep -rn "<img" /srv/dev/mtg-collector/frontend/src | grep -vc "loading="

echo "=== T7 Hand Rolled Modal Overlays Left ==="
grep -rn "fixed inset-0 z-50" /srv/dev/mtg-collector/frontend/src | wc -l

echo "=== T8 Native Dialog Wrapper Used By Three Callers ==="
grep -rln "<Modal" /srv/dev/mtg-collector/frontend/src | wc -l

echo "=== T9 Light Text Left On Amber Buttons ==="
grep -rnE "bg-(indigo|gold)-600" /srv/dev/mtg-collector/frontend/src | grep -vc "text-slate-900"

echo "=== T10 Too Dark Text Shade Left ==="
grep -rn "text-slate-600" /srv/dev/mtg-collector/frontend/src | wc -l

echo "=== T11 Focus Ring And Mobile Field Size Rules Present ==="
grep -cE "focus-visible|font-size: 16px" /srv/dev/mtg-collector/frontend/src/index.css
```

**Résultats attendus :**

| Test | Attendu |
|------|---------|
| T1 | Aucune erreur ni avertissement, code de sortie 0 |
| T2 | `✓ built`, code de sortie 0 |
| T3 | 14 lignes `OK`, aucune ligne `FAIL`, code de sortie 0 |
| T4 | `14` |
| T5 | `5` |
| T6 | `0` |
| T7 | `0` |
| T8 | `3` |
| T9 | `0` |
| T10 | `0` |
| T11 | `2` |

**Non couvert par ces tests (à vérifier à l'œil par le propriétaire)** : rendu réel sur
ordinateur et sur téléphone, ouverture / fermeture / focus des trois modales, absence
de zoom sur les champs dans Safari iOS, confort des boutons −/+ et éditer / supprimer.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-10-05 | T1 Lint (itération 1, vérificateur) | 0 erreur, code 0 | 22 erreurs `no-undef`, code 1, dans `scripts/gen-icons.mjs` (20, fichier préexistant) et `scripts/check-contrast.mjs` (2) ; `src/` à 0 erreur | ❌ |
| 2026-10-05 | T1 Lint (itération 2, auto-check même contexte, garantie moindre) | 0 erreur, code 0 | `eslint src` exécuté sans le filtre de sortie `rtk` : 0 erreur, code 0. L'échec de l'itération 1 venait du filtre, qui remplace `npm run lint` par un lint de tout le dossier, `scripts/` compris. `check-contrast.mjs` déclare désormais ses globales Node et passe aussi | ✅ |
| 2026-10-05 | Vérification visuelle (propriétaire, ordinateur et téléphone) | Rendu conforme, modales et champs utilisables | « C'est validé » | ✅ |
| 2026-10-05 | T2 Build (vérificateur) | `✓ built`, code 0 | `✓ built in 4.60s`, code 0 | ✅ |
| 2026-10-05 | T3 Contraste (vérificateur) | 14 `OK`, code 0 | 14 `OK`, 0 `FAIL`, code 0 | ✅ |
| 2026-10-05 | T4 Chunks par route (vérificateur) | 14 | 14 | ✅ |
| 2026-10-05 | T5 Nuances générées (vérificateur) | 5 | 5 | ✅ |
| 2026-10-05 | T6 Images sans lazy (vérificateur) | 0 | 0 | ✅ |
| 2026-10-05 | T7 Voiles faits main (vérificateur) | 0 | 0 | ✅ |
| 2026-10-05 | T8 Appelants de Modal (vérificateur) | 3 | 3 | ✅ |
| 2026-10-05 | T9 Texte clair sur ambre (vérificateur) | 0 | 0 | ✅ |
| 2026-10-05 | T10 `text-slate-600` restant (vérificateur) | 0 | 0 | ✅ |
| 2026-10-05 | T11 Règles focus et 16 px (vérificateur) | 2 | 2 | ✅ |

## Journal de session

### Session 2026-10-05
- ✅ Fait : audit Impeccable, cadrage, création du plan et de l'issue #2
- ✅ Fait : étapes 1 à 7 implémentées en one-shot sur la branche `fix/2-corrections-audit-interface` ; tests automatiques T1 à T11 passés
- ✅ Fait : commits `8d40c78` et `da6271e` poussés sur `main` ; rendu validé par le propriétaire ; plan clôturé
- ℹ️ Écarts au plan : la valeur de l'infobulle de courbe passe du vert au bleu (règle « un montant est bleu ») ; les boutons −/+ passent à 36 px sur mobile (44 px débordait de la tuile d'extension) ; glyphes ✎ ✕ ⎋ remplacés par des icônes Lucide sur les boutons retouchés
