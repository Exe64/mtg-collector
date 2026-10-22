---
plan:
  id: '4'
  name: 4-trouver-un-commandant.md
  link: https://github.com/Exe64/mtg-collector/blob/main/doc/roadmap/4-trouver-un-commandant.md
status: active
date: 2026-10-20
description: >
  Page « Commandants » calquée sur l'outil find-commander de Manamancer : trouver
  un nouveau commandant parmi tous les commandants légaux ou parmi les légendes
  de la collection, avec données EDHREC et Commander Spellbook en cache.
priority: medium
complexity: L
intent: null
depends_on: ['3']
blocks: []   # futur plan « Deck builder & mes decks »
scope:
  modules:
    - backend/migrations/
    - backend/src/services/cards.js
    - backend/src/services/commanders.js
    - backend/src/routes/commanders.js
    - backend/src/services/deckCheck.js
    - backend/src/services/jobRunner.js
    - frontend/src/pages/Commanders.jsx
    - frontend/src/components/commanders/
    - frontend/src/components/ui/Layout.jsx
  patterns:
    - "backend/src/**/*.js"
    - "frontend/src/**/*.jsx"
issue:
  id: 4
  url: https://github.com/Exe64/mtg-collector/issues/4
---

# [🧙] Plan #4 - Trouver un commandant

## Objectif

Aider à choisir son prochain commandant, parmi tous les commandants légaux ou seulement parmi les légendes déjà en collection. Le modèle est l'outil https://manamancer.com/tools/find-commander, sans les données playgroup.gg ni l'IA.

## Périmètre

### Inclus
- Route `/commanders` et entrée de navigation « Commandants » à côté de Deck check
- **Parcourir** : tous les commandants légaux, badge « possédé », filtre « Dans ma collection ». Filtres : identité couleur (exactement / incluant / au plus), valeur de mana max, type de créature, appariement, prix max, sans Game Changers, recherche nom/oracle. Tris : popularité (rang EDHREC), prix, nouveauté, A–Z. Puces de filtres actifs et aide « assouplir un filtre » quand rien ne correspond
- **Ma collection** : légendes possédées (par `oracle_id`), % du deck moyen EDHREC déjà possédé et coût en € pour le compléter (via `checkDeck`). État « calcul en cours » tant que le cache n'est pas rempli
- **Matchmaker** : quiz de 5 questions (couleurs, thème, budget, puissance, possédé ou découverte), score par règles avec les raisons affichées, réponses modifiables sans relancer le quiz
- **Thèmes / Typal** : tags EDHREC (410 thèmes) et types de créature tirés du `type_line`
- **Fiche commandant** dans un panneau dédié (URL `?c=`) : rang EDHREC, Game Changer, thèmes, % possédé, combos Commander Spellbook avec les pièces possédées, cartes les plus jouées, similaires. Bouton « Construire avec » qui envoie les cartes manquantes en wishlist
- **Présélection ☆** (4 max, en base par utilisateur), **Comparer** côte à côte, **Surprenez-moi**
- Appariements (Partenaire, Partenaire avec, Choisir un Historique, Amis pour toujours, Compagnon du Docteur) : détection, filtre et badge. Un Historique ne peut pas mener seul

### Hors scope
- Stats de table et Nouveautés (playgroup.gg), choix par IA
- Sélecteur de paire de partenaires (identité, prix et % calculés sur la paire)
- Deck builder et « mes decks » : plan séparé à créer ensuite, qui branchera « Construire avec »

## Étapes

**Lot 1 — Backend**
- [x] Étape 1 — Migration `cards` (`legal_commander`, `edhrec_rank`, `game_changer`, `keywords`) + `mapScryfallCard`, puis resynchro du bulk (S · standard → Sonnet)
- [x] Étape 2 — Service + `GET /api/commanders` : catalogue légal dédoublonné par `oracle_id`, impression la moins chère en €, drapeau « possédé », appariement détecté (M · standard → Sonnet)
- [x] Étape 3 — Cache externe : table de cache (TTL 7 j), clients EDHREC et Commander Spellbook limités à ~1 requête/s, job de fond (légendes possédées + thèmes) branché sur `jobRunner` (M · reasoning → Opus)
- [x] Étape 4 — `GET /api/commanders/:oracleId` (fiche : thèmes, couverture du deck moyen via `checkDeck`, combos et pièces possédées, cartes principales, similaires) + `POST …/missing-to-wishlist` (M · standard → Sonnet)
- [x] Étape 5 — Table et routes de présélection (4 max par utilisateur) (S · standard → Sonnet)

**Lot 2 — Frontend**
- [x] Étape 6 — Page `/commanders` + entrée de nav. Mode Parcourir : panneau de filtres, puces, tri, grille/liste, aide « assouplir un filtre » (L · reasoning → Opus)
- [x] Étape 7 — Modes Ma collection et Thèmes / Typal (M · standard → Sonnet)
- [x] Étape 8 — Fiche en panneau (`?c=`), barre de présélection ☆, comparaison, Surprenez-moi (L · reasoning → Opus)
- [x] Étape 9 — Matchmaker : quiz de 5 questions, score par règles avec raisons, réponses modifiables, test qui vérifie le calcul du score (M · standard → Sonnet)

**Lot 3 — Fiche en page dédiée (ajout 2026-10-22)**
- [x] Étape 10 — Backend : la fiche renvoie la decklist complète du deck moyen (nom, qté, possédée, prix, image, type tiré de `cards`) ; couverture inchangée (S · standard → Sonnet)
- [x] Étape 11 — Page `/commanders/:id` à la place du panneau `?c=` (tuiles, présélection, comparaison, similaires ; anciens liens `?c=` redirigés ; « Retour » avec filtres conservés pour l'onglet) (M · standard → Sonnet)
- [x] Étape 12 — Decklist sur la page : groupée par type, possédées cochées, manquantes atténuées avec prix, filtre « Manquantes seulement », « Copier la liste » (texte Moxfield / MTGO), clic → modale carte (M · standard → Sonnet)

**Lot 4 — Variantes de deck (ajout 2026-10-22)**
- [x] Étape 13 — Backend : `GET /api/commanders/:id/deck?theme=&budget=&bracket=` (deck moyen EDHREC par thème, prix Budget / Cher, niveau 1-5), cache 7 j par combinaison, nombre de decks ; « Manquantes en wishlist » suit la variante (S · standard → Sonnet)
- [x] Étape 14 — Frontend : sélecteurs Prix / Puissance / Thème au-dessus de la decklist, titre de variante, choix dans l'URL, lien vers les autres commandants du thème, combinaison absente signalée (M · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test
- [ ] ✅ Validation — Vérifier les résultats des tests et clôturer

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Source du catalogue | Table `cards` locale (bulk Scryfall `default_cards`), enrichie de `legalities.commander`, `edhrec_rank`, `game_changer` et `keywords` | Déjà synchronisée chaque semaine, aucun appel externe pour Parcourir |
| % possédé | Deck moyen EDHREC (`json.edhrec.com/pages/average-decks/<slug>.json`), comparé avec `checkDeck` | Même mesure que Manamancer. L'API est non officielle : cache et dégradation propre si elle tombe |
| Thèmes | `json.edhrec.com/pages/tags.json` (410 tags) puis `pages/tags/<tag>.json`. Thèmes d'un commandant : `panels.taglinks` de sa page | `typal/*` répond 403, d'où le typal calculé depuis le `type_line` |
| Combos | API publique `backend.commanderspellbook.com/variants` | Montre les pièces possédées sur la fiche |
| Rafraîchissement | Job de fond via `jobRunner`, ~1 requête/s, TTL 7 j. Récupération à la demande si absent ou périmé à l'ouverture d'une fiche | Les % de « Ma collection » sont disponibles sans attendre chaque fiche |
| Prix | € depuis nos `prices_eur` (impression la moins chère), pas les prix USD d'EDHREC | Cohérent avec le reste de l'app |
| Présélection | Table dédiée par utilisateur | Suit le compte sur tous les appareils |
| Fiche | Panneau propre à la page, avec URL `?c=` → remplacé le 2026-10-22 par une page `/commanders/:id` avec la decklist complète du deck moyen | Demande utilisateur : la decklist servant au % possédé était introuvable (seules les manquantes s'affichaient) |
| « Construire avec » | Envoie les manquantes en wishlist | Pas encore de deck builder (plan séparé à suivre) |
| Matchmaker | 5 questions calculables. Mode de victoire, rythme, interaction et complexité retirés | Pas de données playgroup.gg |
| Ordre | Démarrage une fois #3 mergé (ou depuis `feat/3`) | Hériter des nouveaux tokens visuels |
| Popularité (ajout 2026-10-21) | Classement des commandants EDHREC (`pages/commanders/year`, ~70 pages, 2 ans) mis en cache par le job ; repli sur `edhrec_rank` Scryfall tant qu'il est absent | `edhrec_rank` mesure la carte dans les 99 (Syr Konrad n°1, Atraxa 2362ᵉ) : inutilisable pour trier des commandants |
| Couverture (précision) | Calcul groupé `coverage()` sur la clé de `checkDeck` (face avant, minuscules, toutes versions), terrains de base exclus, une requête de possession par appel | Ma collection chiffre des centaines de decks en un appel : `checkDeck` ferait une requête par commandant |
| Volume (prod : 35 000+ cartes) | Migrations purement additives (colonnes nullables ou à défaut constant, nouvelles tables) ; index `lower(split_part(name, ' // ', 1))` ; catalogue en cache Redis 6 h ; gzip nginx (2,6 Mo → 760 Ko) | Aucune réécriture de table en prod, requêtes de possession ≤ 200 ms mesurées sur 35 025 entrées |
| Possession (précision 2026-10-22) | Toujours par carte (nom, face avant), jamais par édition : la fiche pointe l'exemplaire possédé, la modale affiche le total toutes éditions ; les cartes « Art Series » (type « Card ») ne comptent pas, ici comme dans Vérif deck | Retour utilisateur : posséder Sol Ring dans une édition doit suffire, quelle que soit l'impression montrée |
| Variantes de deck (ajout 2026-10-22) | Chemin EDHREC `average-decks/<slug>[/<niveau>][/<thème>][/<budget\|expensive>]`, combinable ; « le plus performant » = niveaux de puissance (brackets 1-5), EDHREC ne mesurant pas les victoires ; choix dans l'URL en `replace` | Demande utilisateur (thème appliqué au commandant affiché, deck cher, deck performant) ; « Retour » ramène toujours à la liste |
| Navigation mobile | « Commandants » rangé dans la feuille « Plus » | Barre basse déjà pleine (7 onglets + Plus) |

## Tests

### Prérequis pour les tests

```bash
cd /srv/dev/mtg-collector
docker compose up -d --build backend frontend
docker compose exec backend npm run sync:bulk
```

Compte de test local `cmdtest@example.test` (mot de passe `Cmdtest-Passw0rd!2026`) : 35 000 cartes non légendaires au hasard (échelle de la prod) + 25 commandants connus. Captures : image `mcr.microsoft.com/playwright:v1.64.1-noble` (`--network host`), script hors dépôt.

### Procédure de test

```bash
echo "=== Backend Lint And Unit Tests ==="
cd /srv/dev/mtg-collector/backend && npm run lint && npm test

echo "=== Frontend Lint Unit Tests And Build ==="
cd /srv/dev/mtg-collector/frontend && npm run lint && npm test && npm run build

echo "=== Commander Data After Bulk Sync ==="
docker compose exec -T postgres sh -c 'psql -U $POSTGRES_USER -d magic_collection -c "select count(*) filter (where legal_commander), count(*) filter (where game_changer), count(edhrec_rank), count(keywords) from cards"'
```

Puis, connecté avec le compte de test : appels API (catalogue, Ma collection, thèmes, fiche, présélection, wishlist, erreurs 400/404/409), `EXPLAIN ANALYZE` des requêtes sur 35 025 entrées, captures desktop 1440 × 900 et mobile 390 × 844 de chaque mode avec contrôle `scrollWidth > innerWidth`.

**Résultats attendus :** lint et tests verts ; migrations sans réécriture ; catalogue de ~3 500 commandants trié par le classement EDHREC ; couverture et coût calculés ; présélection plafonnée à 4 ; rendu conforme, aucun débordement.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-10-21 | Étape 1 : migration + `sync:bulk` | colonnes ajoutées sans réécriture, données remplies | migration instantanée ; sync 119 104 cartes en 43 s ; 108 385 légales, 511 Game Changers, 104 050 rangs, 49 924 avec mots-clés | ✅ PASS |
| 2026-10-21 | Étapes 1-3 : `npm test` backend (mapping Commander, appariement, couverture, slug EDHREC) | tous verts | 20 tests, 0 échec ; lint 0 erreur | ✅ PASS |
| 2026-10-21 | Étape 2 : `GET /api/commanders` | catalogue dédoublonné, rapide | 3 470 commandants, 345 ms à froid puis 139 ms (cache) ; 2,6 Mo → 760 Ko en gzip ; noms réversibles « X // X » ramenés à « X » | ✅ PASS |
| 2026-10-21 | Étape 2 : tri popularité (passe 1, `edhrec_rank` Scryfall) | commandants les plus joués en tête | Syr Konrad n°1, Atraxa 2362ᵉ : le rang Scryfall mesure les 99 | ❌ FAIL |
| 2026-10-21 | Étape 2 : tri popularité (passe 2, classement EDHREC) | idem | Y'shtola, Edgar Markov, The Ur-Dragon, Atraxa, Krenko ; 3 295 / 3 470 classés | ✅ PASS |
| 2026-10-21 | Étape 3 : job de fond `commander-cache` | classement, 23 commandants possédés, thèmes en cache | classement + 23 pages + 23 decks moyens + 410 thèmes ; ~1 requête/s ; Historique en 404 mis en cache (`data` NULL) | ✅ PASS |
| 2026-10-21 | Étape 4 : fiche Atraxa | thèmes, couverture, combos, cartes phares, similaires | 12 thèmes ; 78 % (67/86), 19 manquantes ≈ 54,83 € ; 5 combos avec pièces possédées ; 1re ouverture 0,73 s puis cache | ✅ PASS |
| 2026-10-21 | Étape 4 : `missing-to-wishlist` ×2, Historique, id inconnu ou invalide | 19 ajoutées puis 0 ; 404 ; 404 | 19 / 0 (idempotent) ; 404 « Pas de deck moyen » ; 404 ; 404 | ✅ PASS |
| 2026-10-21 | Étape 5 : présélection | 4 max, 409 au-delà, doublon accepté, 400 si invalide | 201 ×4, 409, 201 (doublon), 400, DELETE 204 | ✅ PASS |
| 2026-10-21 | Charge prod : `EXPLAIN ANALYZE` sur 35 025 entrées | requêtes de possession et de prix acceptables | noms possédés 180 ms ; prix de 8 000 noms 209 ms (index `idx_cards_front_lower`) | ✅ PASS |
| 2026-10-21 | Étape 9 : `npm test` frontend (filtres, assouplir, tris, score du Matchmaker) | tous verts | 6 tests, 0 échec ; lint 0 erreur ; build OK | ✅ PASS |
| 2026-10-21 | Étapes 6-9 : captures passe 1 (10 écrans × desktop + mobile) | rendu conforme, aucun débordement | débordement 0 partout ; sélecteur « Exactement » coupé à droite du panneau de filtres en mobile | ❌ FAIL |
| 2026-10-21 | Captures passe 2 après correctif (`flex-wrap` des couleurs) | rendu conforme, aucun débordement | 20 captures, débordement 0 ; sélecteur passé à la ligne en mobile ; seule erreur console : 401 du refresh avant connexion (attendu) | ✅ PASS |
| 2026-10-21 | Non-régression `POST /api/decks/check` (fonctions exportées) | réponse inchangée | 200, `cards[]` avec versions possédées | ✅ PASS |
| 2026-10-22 | Étape 10 : `GET /api/commanders/:id` → `deck[]` (Atraxa) | 99 cartes, possession cohérente avec le % | 90 lignes / 99 cartes, 4 lignes de terrains de base ; 67 possédées sur 86 comptées = `coverage` (78 %) | ✅ PASS |
| 2026-10-22 | Étapes 11-12 : parcours navigateur desktop + mobile (tuile → page, retour, ancien lien `?c=`, decklist) | page dédiée en haut, filtres et défilement retrouvés, redirection, filtre et copie OK | URL `/commanders/<id>`, défilement 0 ; retour : puce « Exactement G » et défilement du clic restaurés ; `?c=` → page ; 90 lignes, 19 manquantes ; presse-papiers 91 lignes (commandant en tête) ; clic → modale ; débordement 0 ; aucune erreur console | ✅ PASS |
| 2026-10-22 | Étape 12 : groupes de la decklist (passe 1) | chaque carte dans son type | Skithiryx et Tamiyo en « Autres » : `cardsByFront` choisissait la carte « Art Series » (type « Card », 0,13 € au lieu de 7,12 €), aussi utilisée pour les prix et l'envoi en wishlist | ❌ FAIL |
| 2026-10-22 | Étape 12 : passe 2 (impressions jouables d'abord dans `cardsByFront` et `missing-to-wishlist`) | groupes et prix justes | Skithiryx en Créatures à 7,12 €, Tamiyo en Planeswalkers à 1,24 € ; aucune carte de type « Card » dans le deck ; tests backend 20/20, frontend 7/7 | ✅ PASS |
| 2026-10-22 | Possession par carte : Sol Ring possédé uniquement en Alpha (LEA), compte de test | « possédée » dans la decklist, clic → exemplaire LEA, modale : total toutes éditions | possédée, `scryfall_id` LEA ; modale « Dans ta collection : 1 exemplaire(s), toutes éditions », « Cette édition : 1 » ; carte non possédée → « Pas dans ta collection » | ✅ PASS |
| 2026-10-22 | Possession : cartes « Art Series » | ne valent pas la carte | passe 1 : Sol Ring pointait « Sol Ring // Sol Ring » (Art Series) ❌ ; après filtre `PLAYABLE` : LEA ; couverture Atraxa 78 % → 76 % (2 cartes n'étaient « possédées » que via Art Series) ; Vérif deck : Sol Ring = LEA seul ; tests 20/20 | ✅ PASS |
| 2026-10-22 | Étape 13 : `GET /api/commanders/:id/deck` (Atraxa) | variantes combinables, cache, combinaison absente, validation | Infect 3 729 decks (71 %) ; Cher 4 576 ; cEDH 193 ; Optimized + Infect + Cher 40 decks (78 %) ; 2e appel 0,25 s contre 1,1 s ; thème inconnu → `deck: null` ; `bracket=bad`, `theme=BAD!` → 400 ; wishlist variante cEDH : 17 manquantes, 8 ajoutées (9 déjà présentes) | ✅ PASS |
| 2026-10-22 | Étape 14 : parcours navigateur desktop + mobile | puce de thème → deck du thème, sélecteurs Prix / Puissance / Thème, URL, combinaison absente signalée, retour à la liste | « Deck Infect » (3 729 decks) ; « Deck Infect · Cher · 4 · Optimized », URL `theme=infect&budget=expensive&bracket=optimized`, 98 lignes ; Aggro · Cher · cEDH → « EDHREC n'a pas de deck pour cette combinaison » ; « Commandants » → `/commanders` ; débordement 0 ; aucune erreur console ; tests frontend 8/8, backend 20/20 | ✅ PASS |

## Journal de session

### Session 2026-10-20
- ✅ Fait : cadrage (bundle et textes FR de l'outil Manamancer analysés, API EDHREC et Commander Spellbook sondées), plan et issue #4 créés
- 📋 Prochain : merger #3, puis étape 1

### Session 2026-10-21
- ✅ Fait : étapes 1 à 9 enchaînées sur `feat/4-trouver-un-commandant` (option ⚡ one-shot) ; tests autonomes consignés ci-dessus
- ⚠️ Prod (35 000+ cartes) : migrations additives uniquement ; relancer `sync:bulk` une fois après déploiement (sinon catalogue vide)
- 📋 Prochain : validation utilisateur, commits, PR

### Session 2026-10-22
- ✅ Fait : retour utilisateur après mise en prod (decklist du % introuvable, fiche en panneau) → étapes 10 à 12 : page `/commanders/:id` avec decklist complète groupée par type, filtre manquantes, copie, retour avec filtres et défilement ; correctif des cartes « Art Series » (prix et wishlist)
- ⚠️ Prod : un « Construire avec » lancé avant ce correctif a pu ajouter des cartes « Art Series » en wishlist (à vérifier)
- ✅ Fait : possession par carte et non par édition (exemplaire possédé ouvert depuis la decklist, total toutes éditions dans la modale, cartes « Art Series » exclues de la possession, Vérif deck compris)
- ✅ Fait : étapes 13-14, variantes de deck (thème du commandant affiché, Budget / Cher, niveaux de puissance 1-5)
- 📋 Prochain : validation utilisateur puis clôture
