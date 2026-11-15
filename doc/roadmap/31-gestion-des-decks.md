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
    - backend/src/services/commanders.js
    - backend/src/services/deckCheck.js
    - backend/src/services/decks.js
    - backend/src/routes/decks.js
    - backend/src/routes/commanders.js
    - backend/src/validation/schemas.js
    - backend/API.md
    - frontend/src/components/decks/
    - frontend/src/components/commanders/Decklist.jsx
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
- [x] Étape 1 — Migration `cards.legalities` (JSONB) + `mapScryfallCard`, puis resynchro du bulk (S · standard → Sonnet)
- [x] Étape 2 — Migration `decks` (nom, format, notes, dates) et `deck_cards` (deck, carte, quantité, zone, unique par deck + carte + zone) (S · standard → Sonnet)
- [x] Étape 3 — Service + routes CRUD `/api/decks` et `/api/decks/:id/cards` ; limiteur de recherche restreint à `/check` (M · standard → Sonnet)
- [x] Étape 4 — Création par import : `parseDeckText` conserve les sections (Commander, Sideboard, Maybeboard), Moxfield idem ; choix de l'impression (possédée, sinon la moins chère) (M · reasoning → Opus)
- [x] Étape 5 — Fiche deck : couverture via `checkDeck`, coût de complétion, valeur, stats (courbe, couleurs, types), cartes utilisées dans d'autres decks, contrôles de légalité (M · reasoning → Opus)

**Lot 2 — Frontend**
- [x] Étape 6 — Page `/decks` + entrée de navigation : tuiles illustrées, % possédé, création vide ou par import (M · standard → Sonnet)
- [x] Étape 7 — Page `/decks/:id` : liste groupée par type (réutilise `Decklist`), recherche pour ajouter, quantité, zone, changement d'impression, filtre « manquantes » (L · reasoning → Opus)
- [x] Étape 8 — Statistiques et alertes de légalité, « Copier la liste », « Manquantes en wishlist » (S · standard → Sonnet)

**Lot 3 — Branchements**
- [x] Étape 9 — « Construire avec » (fiche commandant) crée le deck ; « Vérif deck » : « Enregistrer comme deck », page rattachée à Decks (M · standard → Sonnet)
- [x] Étape 10 — Modale carte : « Utilisée dans… » avec liens vers les decks (S · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test
- [ ] ✅ Validation — Vérifier les résultats des tests et clôturer

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Lien avec l'inventaire | Liste virtuelle : un deck ne réserve aucun exemplaire ; drapeau informatif si une carte possédée sert dans plusieurs decks | Validé le 2026-11-15. Évite de toucher inventaire et journal à chaque édition de deck |
| Impression d'une ligne | `deck_cards.card_id` pointe une impression ; par défaut l'exemplaire possédé (le plus détenu), sinon la moins chère ; modifiable. Possession comparée par nom (face avant) | Validé le 2026-11-15, avec la préférence « piocher dans ma collection d'abord ». Réutilise `ownedFrontNames` et `cardsByFront` |
| Formats | Toutes les légalités Scryfall stockées en JSONB sur `cards` ; légalité vérifiée pour tout format, règles de construction pour Commander seulement | Validé le 2026-11-15 (alternative retenue). Coût : une migration et une resynchro du bulk |
| `legal_commander` existant | Conservé (index, catalogue #4) ; dérivable de `legalities` | Pas de régression sur la page Commandants |
| Statistiques (précision 2026-11-15) | Courbe, couleurs et types calculés côté client (`deckStats`) à partir des lignes renvoyées par la fiche | Les lignes portent déjà `cmc`, `colors`, `type_line` ; regroupement par type partagé avec la decklist EDHREC (`groupByType`) |
| Ajout par recherche (précision) | `POST /decks/:id/cards { name, scryfall_id }` : impression choisie par nom comme à l'import, `scryfall_id` en repli | La recherche Scryfall renvoie son impression par défaut, pas celle de la collection |
| Navigation (précision) | « Decks » remplace « Vérif deck » dans la barre ; `/deck` reste accessible depuis Decks et garde l'onglet actif | Barre déjà pleine ; la vérification devient une étape avant l'enregistrement |
| Vérif deck (précision) | Le « peut-être » (Maybeboard) n'entre plus dans la vérification | Les cartes envisagées ne sont pas des cartes du deck |
| Wishlist (précision) | Insertion des manquantes factorisée dans `namesToWishlist` (commandants et decks) | Même règle : impression la moins chère, noms déjà en wishlist ignorés |

## Tests

### Prérequis pour les tests

```bash
cd /srv/dev/mtg-collector
docker compose up -d --build backend frontend
docker compose restart frontend          # nginx garde sinon l'ancienne IP du backend (502)
docker compose exec backend npm run sync:bulk
```

Compte de test local `cmdtest@example.test` (mot de passe `Cmdtest-Passw0rd!2026`), même jeu que #4. Captures : image `mcr.microsoft.com/playwright:v1.64.1-noble` (`--network host`), script hors dépôt.

### Procédure de test

```bash
echo "=== Backend Lint And Unit Tests ==="
cd /srv/dev/mtg-collector/backend && npm run lint && npm test

echo "=== Frontend Lint Unit Tests And Build ==="
cd /srv/dev/mtg-collector/frontend && npm run lint && npm test && npm run build

echo "=== Legalities After Bulk Sync ==="
cd /srv/dev/mtg-collector && docker compose exec -T postgres sh -c 'psql -U $POSTGRES_USER -d magic_collection -c "select count(*), count(legalities) from cards"'
```

Puis, connecté avec le compte de test : appels API (import par liste avec sections et carte inconnue, fiche, impressions, changement d'impression et de zone avec fusion, retrait, format, erreurs 400/404, liste, `by-card`, Vérif deck, « Construire avec » simple et variante, ajout par nom, manquantes en wishlist ×2) ; parcours navigateur desktop 1440 × 900 et mobile 390 × 844 avec contrôle `scrollWidth > innerWidth`.

**Résultats attendus :** lint et tests verts ; légalités remplies ; impression possédée sinon la moins chère ; contrôles Commander (taille, singleton, identité, commandant) et légalité par format ; « Construire avec » → deck de 100 cartes au même % que la fiche commandant ; aucune modification de la collection ; rendu sans débordement.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-11-15 | Étapes 1-2 : migrations + `sync:bulk` | colonne `legalities` et tables sans réécriture | migrations instantanées ; 120 135 cartes en 58 s, 120 135 avec `legalities` ; `deck_cards` : unicité deck + carte + zone, CHECK zone et quantité | ✅ PASS |
| 2026-11-15 | Étapes 4-5 : `npm test` backend (parse par sections, contrôles de légalité) passe 1 | tous verts | « Relentless Rats » signalé en double : la regex attendait « any number cards » | ❌ FAIL |
| 2026-11-15 | Passe 2 (regex `any number of`, assertion de taille corrigée) | tous verts | 23 tests, 0 échec ; lint 0 erreur | ✅ PASS |
| 2026-11-15 | Étapes 3-5 : API (import, fiche, impressions, fusion, format, erreurs) | conforme aux décisions | import : « Totally Fake Card » dans `unknown` ; Sol Ring → exemplaire LEA possédé, Lightning Bolt → SLD (le plus détenu) ; Mana Crypt bannie, Counterspell hors identité, doublons signalés, « 37 cartes sur 100 » ; 79 impressions de Bolt ; zone réserve → principal fusionne (3 ex.) ; Modern : Mana Crypt, Pyroblast, Sol Ring non légales ; 400 (format, PATCH vide, id), 404 (deck inconnu) ; fiche 50 ms, liste 20 ms | ✅ PASS |
| 2026-11-15 | Étape 9 : `POST /commanders/:id/build` (Atraxa) | deck de 100 cartes, % = fiche #4 | 100 / 100, 76 % (comme la fiche), 21 manquantes ≈ 104,92 €, aucune alerte ; variante Infect créée ; `bracket=zz` → 400 | ✅ PASS |
| 2026-11-15 | Étapes 8 et 10 : ajout par nom, wishlist, `by-card` | impression possédée, idempotent | Sol Ring ×2 par nom → LEA, 1 manquant ; wishlist 1 puis 0 ; nom inconnu → 404, corps vide → 400 ; `by-card` → deck utilisateur, UUID invalide → 400 ; entrée wishlist de test supprimée | ✅ PASS |
| 2026-11-15 | Non-régression Vérif deck | même réponse, « peut-être » exclu | 8 cartes, 39 exemplaires (Maybeboard exclu), 2 manquantes | ✅ PASS |
| 2026-11-15 | Étapes 6-10 : `npm test` frontend (stats, liste texte, groupes) + build | tous verts | 11 tests, 0 échec ; lint 0 erreur ; build OK | ✅ PASS |
| 2026-11-15 | Parcours navigateur passe 1 (desktop + mobile) | création, ajout, édition, construire, modale, Vérif deck | tout fonctionne ; débordement 0 sur la page ; mobile : modale d'impression coupée à droite (`<fieldset>` en `min-width: min-content`), « Commander· Krenko » collés | ❌ FAIL |
| 2026-11-15 | Passe 2 (`min-w-0` sur le fieldset, libellés séparés) | rendu conforme | 14 captures, débordement 0, liste de la modale sans débordement ; onglet Decks actif sur `/decks` et `/deck` ; liste copiée relisible (sections) ; « Utilisée dans : Atraxa, Krenko UI » → lien vers le deck ; « Enregistrer comme deck » → deck avec Réserve ; seules erreurs console : 401 du refresh avant connexion (attendu) | ✅ PASS |

Non joué : `RUN_DB_TESTS=1` (les tests d'intégration vident `users` et `cards`, à lancer sur une base jetable ou en CI).

## Journal de session

### Session 2026-11-15
- ✅ Fait : proposition validée (3 décisions), plan et issue #31 créés
- 📋 Prochain : étape 1

### Session 2026-11-15 (implémentation)
- ✅ Fait : étapes 1 à 10 enchaînées (option ⚡ one-shot), tests autonomes consignés ci-dessus ; `API.md` à jour
- ⚠️ Prod : migrations additives ; relancer `sync:bulk` une fois après déploiement (sinon « Légalité inconnue » sur toutes les cartes)
- 📋 Prochain : validation utilisateur, commits, clôture
