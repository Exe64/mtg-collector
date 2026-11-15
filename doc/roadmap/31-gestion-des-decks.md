---
plan:
  id: '31'
  name: 31-gestion-des-decks.md
  link: https://github.com/Exe64/mtg-collector/blob/main/doc/roadmap/31-gestion-des-decks.md
status: active
date: 2026-11-15
description: >
  Decks enregistrés : listes virtuelles comparées à la collection, impression
  choisie dans la collection puis la moins chère, légalité par format.
  Branche « Construire avec » (#4) et « Vérif deck ».
priority: medium
complexity: L
intent: null
depends_on: ['4']
blocks: []
scope:
  modules:
    - backend/migrations/
    - backend/src/services/cards.js
    - backend/src/services/deckCheck.js
    - backend/src/services/decks.js
    - backend/src/routes/decks.js
    - backend/src/routes/commanders.js
    - backend/src/validation/schemas.js
    - frontend/src/pages/Decks.jsx
    - frontend/src/pages/DeckDetail.jsx
    - frontend/src/pages/DeckCheck.jsx
    - frontend/src/pages/CommanderDetail.jsx
    - frontend/src/components/ui/Layout.jsx
    - frontend/src/components/ui/CardModal.jsx
    - frontend/src/App.jsx
issue:
  id: 31
  url: https://github.com/Exe64/mtg-collector/issues/31
---

# [🃏] Plan #31 - Gestion des decks

## Objectif

Enregistrer ses decks dans l'application et voir, pour chacun, ce qui est possédé, ce qui manque et ce que coûte la complétion. Ce plan reprend le « Deck builder et mes decks » laissé hors périmètre par #4, et branche ses boutons « Construire avec » et « Vérif deck ».

## Périmètre

### Inclus
- Tables `decks` et `deck_cards` ; zones commandant / principal / réserve / peut-être
- Légalités Scryfall complètes stockées sur `cards` (migration + resynchro du bulk)
- CRUD des decks et de leurs cartes ; création par liste collée, `.txt` ou URL Moxfield
- Impression par défaut : l'exemplaire possédé, sinon l'impression la moins chère ; modifiable
- Fiche deck : possédées / manquantes, coût de complétion, valeur, courbe de mana, couleurs, types
- Drapeau « déjà utilisée dans un autre deck » pour les cartes possédées
- Contrôles de légalité selon le format du deck ; règles Commander (100 cartes, exemplaire unique, identité couleur)
- « Construire avec » crée un deck depuis le deck moyen EDHREC ; « Vérif deck » propose « Enregistrer comme deck »
- Modale carte : decks qui utilisent la carte

### Hors scope
- Réservation réelle des exemplaires (un deck ne modifie jamais la collection ni le journal)
- Test de main de départ, historique des versions, partage public, courbe de prix d'un deck
- Règles de construction propres aux autres formats (taille 60/15, 4 exemplaires) : seule la légalité de chaque carte est vérifiée hors Commander

## Étapes

**Lot 1 — Backend**
- [ ] Étape 1 — Migration `cards.legalities` (JSONB) + `mapScryfallCard`, puis resynchro du bulk (S · standard → Sonnet)
- [ ] Étape 2 — Migration `decks` (nom, format, notes, dates) et `deck_cards` (deck, carte, quantité, zone, unique par deck + carte + zone) (S · standard → Sonnet)
- [ ] Étape 3 — Service + routes CRUD `/api/decks` et `/api/decks/:id/cards` ; limiteur de recherche restreint à `/check` (M · standard → Sonnet)
- [ ] Étape 4 — Création par import : `parseDeckText` conserve les sections (Commander, Sideboard, Maybeboard), Moxfield idem ; choix de l'impression (possédée, sinon la moins chère) (M · reasoning → Opus)
- [ ] Étape 5 — Fiche deck : couverture via `checkDeck`, coût de complétion, valeur, stats (courbe, couleurs, types), cartes utilisées dans d'autres decks, contrôles de légalité (M · reasoning → Opus)

**Lot 2 — Frontend**
- [ ] Étape 6 — Page `/decks` + entrée de navigation : tuiles illustrées, % possédé, création vide ou par import (M · standard → Sonnet)
- [ ] Étape 7 — Page `/decks/:id` : liste groupée par type (réutilise `Decklist`), recherche pour ajouter, quantité, zone, changement d'impression, filtre « manquantes » (L · reasoning → Opus)
- [ ] Étape 8 — Statistiques et alertes de légalité, « Copier la liste », « Manquantes en wishlist » (S · standard → Sonnet)

**Lot 3 — Branchements**
- [ ] Étape 9 — « Construire avec » (fiche commandant) crée le deck ; « Vérif deck » : « Enregistrer comme deck », page rattachée à Decks (M · standard → Sonnet)
- [ ] Étape 10 — Modale carte : « Utilisée dans… » avec liens vers les decks (S · standard → Sonnet)
- [ ] 🧪 Tests — Rédiger et exécuter la procédure de test
- [ ] ✅ Validation — Vérifier les résultats des tests et clôturer

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Lien avec l'inventaire | Liste virtuelle : un deck ne réserve aucun exemplaire ; drapeau informatif si une carte possédée sert dans plusieurs decks | Validé le 2026-11-15. Évite de toucher inventaire et journal à chaque édition de deck |
| Impression d'une ligne | `deck_cards.card_id` pointe une impression ; par défaut l'exemplaire possédé (le plus détenu), sinon la moins chère ; modifiable. Possession comparée par nom (face avant) | Validé le 2026-11-15, avec la préférence « piocher dans ma collection d'abord ». Réutilise `ownedFrontNames` et `cardsByFront` |
| Formats | Toutes les légalités Scryfall stockées en JSONB sur `cards` ; légalité vérifiée pour tout format, règles de construction pour Commander seulement | Validé le 2026-11-15 (alternative retenue). Coût : une migration et une resynchro du bulk |
| `legal_commander` existant | Conservé (index, catalogue #4) ; dérivable de `legalities` | Pas de régression sur la page Commandants |

## Tests

### Prérequis pour les tests

```bash
# À compléter à l'étape 🧪 Tests
```

### Procédure de test

```bash
# À compléter à l'étape 🧪 Tests
```

**Résultats attendus :** à compléter.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|

## Journal de session

### Session 2026-11-15
- ✅ Fait : proposition validée (3 décisions), plan et issue #31 créés
- 📋 Prochain : étape 1
