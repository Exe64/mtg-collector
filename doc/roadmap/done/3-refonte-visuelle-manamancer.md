---
plan:
  id: '3'
  name: 3-refonte-visuelle-manamancer.md
  link: https://github.com/Exe64/mtg-collector/blob/main/doc/roadmap/done/3-refonte-visuelle-manamancer.md
status: done
date: 2026-10-20
enriched: 2026-10-20
description: >
  Rapprocher le frontend de l'univers visuel de manamancer.com : sable doré sur
  zinc chaud, barre fine avec logotype, titres serif en petites capitales,
  tuiles illustrées par l'art des cartes, verre dépoli avec mesure.
priority: medium
complexity: L
intent: null
blocks: ['4']
scope:
  modules:
    - frontend/tailwind.config.js
    - frontend/src/index.css
    - frontend/src/components/
    - frontend/src/pages/
    - DESIGN.md
    - backend/src/routes/collection.js
    - backend/API.md
  patterns:
    - "frontend/src/**/*.jsx"
issue:
  id: 3
  url: https://github.com/Exe64/mtg-collector/issues/3
---

# [🎨] Plan #3 - Refonte visuelle inspirée de Manamancer

## Objectif

Rapprocher l'application de l'univers visuel de manamancer.com sans perdre la densité des tableaux ni le sens des couleurs (bleu = euros, vert / rose = variations de prix).

## Périmètre

### Inclus
- Tokens Tailwind, polices, styles de base
- Coquille : barre desktop, barre mobile, feuille « Plus »
- Titres de page, boutons, segments, champs, panneaux sur toutes les pages
- Hero du tableau de bord (bannière floutée)
- Tuiles illustrées : grille SetDetail, Wishlist, Extensions, en-tête de la modale carte
- Réécriture de DESIGN.md

### Hors scope
- Logique métier, API, backend
- Conversion des tableaux denses en cartes
- Thème clair
- Nouveaux écrans ou fonctionnalités ; sections Manamancer sans équivalent (decks publics, IA)

## Étapes

**Lot 1**
- [x] Étape 1 — Tokens : `slate` remappé en zinc chaud, `indigo` / `gold` en échelle sable `#c8a45c`, serif petites capitales auto-hébergé (Cormorant Garamond remplace Cinzel), utilitaires de base (`.glass`, titre de page, segment) (M · standard → Sonnet)
- [x] Étape 2 — Coquille : barre fine collante en verre, logotype, liens groupés par séparateurs, soulignement or, bouton contour or ; barres mobiles restylées ; bannière retirée de la coquille (M · standard → Sonnet)

**Lot 2**
- [x] Étape 3 — Primitives sur toutes les pages : en-tête de page (titre + sous-titre), boutons, segments en capitales espacées, champs, panneaux 12 px (L · reasoning → Opus)
- [x] Étape 4 — Hero du tableau de bord : bannière floutée en fond, statistiques sur verre (M · standard → Sonnet)
- [x] Étape 5 — Tuiles illustrées : `art_crop` Scryfall dérivé de l'URL existante, tuiles 16 px à pied flouté et pastilles, tuiles d'extension à symbole keyrune en filigrane, en-tête de modale sur art flouté (L · reasoning → Opus)
- [x] Étape 6 — DESIGN.md réécrit, `check:contrast` mis à jour (S · standard → Sonnet)
- [x] Étape 7 — Retouche demandée en validation : hero « MTG Collector / Collect with passion », 5 pastilles WUBRG, recherche dans la collection (`/collection?q=`, raccourci « / »), art flouté de la carte la plus chère en fond (M · standard → Sonnet)
- [x] Étape 8 — Rotation des fonds du hero : illustrations floutées des 5 cartes les plus chères (sans doublon foil), fondu de 1,6 s toutes les 7 s, pastilles WUBRG cliquables comme indicateurs, pastille du nom qui ouvre la carte, rotation figée si `prefers-reduced-motion` (S · standard → Sonnet)
- [x] Étape 9 — Fonds par défaut du hero quand la collection est vide (cause du « pas de fond » constaté : `collection_entries` = 0) : 5 mythiques de Bloomburrow, un par couleur dans l'ordre WUBRG, URL `art_crop` Scryfall (XS · standard → Sonnet)
- [x] Étape 10 — Connexion et création de compte façon référence (`/wishlist` déconnecté) : `AuthShell` (anneau de particules WUBRG en orbite lente, logotype, carte vitrée, pied « projet non officiel »), `Wordmark` partagé avec le hero, champs centrés, mot de passe affichable, bouton contour sable (M · standard → Sonnet)
- [x] Étape 11 — Fond du hero bord à bord de la fenêtre (`mx-[calc(50%-50vw)]`, `overflow-x-clip` sur la racine) ; contenu toujours plafonné à 1800 px (XS · standard → Sonnet)
- [x] Étape 12 — Particules de la connexion sur `<canvas>` (`ParticleRing`) : glissement propre à chaque point, errance aléatoire lissée, répulsion par le pointeur avec retour élastique, scintillement ; figées si `prefers-reduced-motion` ; keyframes `orbit` / `twinkle` supprimées (S · standard → Sonnet)
- [x] Étape 13 — Largeur uniforme : plafonds propres retirés sur Ajouter (`max-w-5xl`), Administration, Vérif deck, Import/Export (`max-w-3xl`) et Sécurité (`max-w-lg`) ; toutes les pages suivent la colonne de 1800 px du `<main>` (XS · standard → Sonnet)
- [x] Étape 14 — Ciel étoilé sur toute la page de connexion : `ParticleRing` devient `Starfield` (champ de 60 à 260 étoiles fines qui dérivent et rebouclent, + anneau ; lueur réservée à l'anneau) (S · standard → Sonnet)
- [x] Étape 15 — Fonds du hero tirés de la collection : route `GET /api/collection/hero-arts?limit=12` (12 cartes au hasard de la collection, rares/mythiques des 6 dernières extensions si vide), documentée dans `backend/API.md` ; fonds par défaut codés en dur supprimés ; pastilles WUBRG allumées selon l'identité de couleur de la carte affichée, clic = prochaine carte de cette couleur (M · standard → Sonnet)
- [x] Étape 16 — Connexion « dans l'espace » : anneau supprimé ; 220 à 900 étoiles (72 % aux couleurs WUBRG) sur 1 profondeur continue (taille, éclat, dérive, parallaxe au pointeur, répulsion), halos en sprites pré-rendus ; nébuleuses WUBRG en fond, base `slate-950` (S · standard → Sonnet)
- [x] Étape 17 — Flou des fonds du hero ramené de 64 à 16 px (agrandissement 125 → 110 %), choisi par l'utilisateur sur comparatif 64 / 32 / 16 / 8 px (XS · standard → Sonnet)
- [x] 🧪 Tests — Rédiger et exécuter la procédure de test (avant-dernière étape, obligatoire)
- [x] ✅ Validation — Vérifier les résultats des tests et clôturer (dernière étape, obligatoire)

## Décisions techniques

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| Portée | Re-skin complet, tableaux denses conservés | Choix utilisateur ; PRODUCT.md : la densité l'emporte au bureau |
| Bannière | Retirée de la coquille, réutilisée en hero flouté du tableau de bord | Choix utilisateur ; garde l'illustration de marque |
| Profondeur | Verre dépoli limité à la nav, aux modales et aux pieds de tuiles sur art ; panneaux de données plats | Choix utilisateur (« avec mesure ») |
| Titres | Serif en petites capitales, Cinzel abandonnée | Choix utilisateur, fidèle à Manamancer |
| Polices | Auto-hébergées via `@fontsource` | CSP stricte, pas de Google Fonts |
| Police titres | `@fontsource/cormorant-sc` (vraies petites capitales) | Cormorant Garamond n'a pas de small-caps natives |
| Art des cartes | URL `art_crop` dérivée de `image_uri_small` (`/small/` → `/art_crop/`) | Aucun changement d'API |

## Tests

### Prérequis pour les tests

```bash
cd /srv/dev/mtg-collector/frontend
```

### Procédure de test

```bash
npm run lint
npm run build
npm run check:contrast
# Captures visuelles : build servi par `npx vite preview --port 4173`, API simulée
# par Playwright (page.route sur /api/**, cartes et extensions réelles lues en base),
# desktop 1440×900 et mobile 390×844, contrôle scrollWidth > innerWidth.
```

**Résultats attendus :** lint et build sans erreur ; contraste conforme (texte ≥ 4.5:1, contrôles ≥ 3:1) ; captures desktop 1440 px et mobile 390 px sans débordement horizontal.

### Résultats joués et vérifiés

| Date | Test | Attendu | Observé | Verdict |
|------|------|---------|---------|---------|
| 2026-10-20 | `npm run lint` | 0 erreur | 0 erreur, 0 avertissement | ✅ PASS |
| 2026-10-20 | `npm run build` | build OK | build OK, SW régénéré | ✅ PASS |
| 2026-10-20 | `npm run check:contrast` | 15 paires conformes | 15/15 OK (segment actif 9.80, bouton contour 10.27, bordure champ / panneau 3.13) | ✅ PASS |
| 2026-10-20 | Captures passe 1 (tableau de bord, extensions, wishlist, SetDetail, mouvements, modale, menu Outils) | rendu conforme, aucun débordement | débordement de 34 px sur SetDetail mobile ; badge Outils sur le libellé ; méta des tuiles d'extension coupée ; bannière rognée | ❌ FAIL |
| 2026-10-20 | Captures passe 2 après corrections | rendu conforme, aucun débordement | aucun débordement desktop ni mobile ; défauts de la passe 1 corrigés | ✅ PASS |
| 2026-10-20 | Étape 7 : lint + build + captures hero desktop / mobile | rendu conforme à la capture de référence, titre sur une ligne en mobile | conforme après 1 retouche (titre mobile, placeholder raccourci, graisse 700) | ✅ PASS |
| 2026-10-20 | Étape 7 : « / » puis « Sol Ring » + Entrée | focus dans la recherche, `/collection?q=Sol%20Ring`, champ prérempli | focus OK, URL `/collection?q=Sol%20Ring`, valeur « Sol Ring » | ✅ PASS |
| 2026-10-20 | Étape 8 : rotation (t0, t0 + 7,5 s), clic sur la 4e pastille, desktop + mobile | nom qui change, 5 pastilles actives, aucun débordement | « Banishing Light » → « Dewdrop Cure » → clic → « Moonstone Harbinger » ; 5 pastilles ; débordement 0 | ✅ PASS |
| 2026-10-20 | Étape 9 : hero avec `topCards: []` | rotation sur les 5 fonds par défaut | « Beza » → « Eluge » → clic 4e pastille → « Dragonhawk » ; débordement 0 | ✅ PASS |
| 2026-10-20 | Étape 10 : connexion desktop + mobile, œil, erreur | rendu conforme, type texte après clic, message d'erreur | type `text`, alerte « Identifiants invalides », débordement 0 ; anneau réduit après passe 1 (particules sur le pied) | ✅ PASS |
| 2026-10-20 | Étape 11 : tableau de bord à 2560 × 1271 et 390 × 844 | fond du hero bord à bord, contenu plafonné, aucun débordement | fond pleine largeur, statistiques dans la colonne de 1800 px, débordement 0 (1re version qui élargissait tout le contenu : corrigée sur retour utilisateur) | ✅ PASS |
| 2026-10-20 | Étape 12 : pointeur posé sur l'anneau puis retiré | zone vidée autour du pointeur puis retour des particules, fluidité | pixels allumés dans 120 px : 2 → 0 avec pointeur → 40 après retrait ; 61 i/s | ✅ PASS |
| 2026-10-20 | Étape 13 : Ajouter, Vérif deck, Import/Export, Sécurité, Administration, Collection à 1920 px | même bord gauche et même largeur que le tableau de bord | toutes alignées à x = 84 px, largeur 1752 px ; Administration testée avec un état système complet | ✅ PASS |
| 2026-10-20 | Étape 14 : connexion 1440 × 900 | étoiles hors de l'anneau, répulsion, fluidité | 71 pixels d'étoiles dans la bande haute ; 76 → 0 → 68 pixels allumés près du pointeur ; 61 i/s | ✅ PASS |
| 2026-10-20 | Étape 15 : requête catalogue (`EXPLAIN ANALYZE`) | rapide | 7 ms (1,15 s à froid, cache vide) | ✅ PASS |
| 2026-10-20 | Étape 15 : hero avec `hero-arts` simulé (12 cartes W/B), desktop + mobile | rotation, pastilles selon couleurs, seules les couleurs présentes cliquables | rotation OK ; pastille blanche allumée sur carte blanche ; 2 pastilles cliquables (W, B) ; débordement 0 | ✅ PASS |
| 2026-10-20 | Étape 15 : route backend | syntaxe valide ; test réel après reconstruction du conteneur backend | `node --check` OK ; ESLint backend non installé sur l'hôte ; clôture demandée par l'utilisateur | ✅ validé utilisateur |
| 2026-10-20 | Étape 16 : connexion 1440 / 2560 / 390 px | ciel dense sans anneau, fluide, répulsion | rendu conforme aux 3 tailles ; 61 / 51 / 61 i/s (rendu logiciel headless) ; zone du pointeur 446 → 286 pixels allumés | ✅ PASS |
| 2026-10-20 | Étape 17 : comparatif de flou (surcharge CSS en navigateur de test) puis build | formes reconnaissables, titre lisible | 16 px retenu ; lint + build OK | ✅ PASS |
| 2026-10-20 | Écrans connectés avec données réelles | validation visuelle par l'utilisateur | captures utilisateur du tableau de bord, de la connexion et des pages reçues au fil des retouches ; « commit, push et clôture » | ✅ validé utilisateur |

## Journal de session

- 2026-10-20 — Validation et clôture demandées par l'utilisateur ; plan passé en `done`, déplacé dans `done/`, issue #3 fermée.

- 2026-10-20 — Étape 15 : premier écart au « hors scope backend » du plan (route de lecture seule `hero-arts`), validé par la demande utilisateur de fonds tirés de sa collection.
- 2026-10-20 — Étape 7 ajoutée sur retour utilisateur : le hero remplace bannière et titre « Tableau de bord ». Nom aligné ensuite sur « MTG Collector » : logotype de la barre, `<title>`, nom et nom court de la PWA.
- 2026-10-20 — Implémentation des étapes 1 à 6 en une passe (branche `feat/3-refonte-visuelle`). Ajouts hors plan initial : `aria-pressed` sur les segments. Sous-titres de page non ajoutés (pas de nouveau texte sans accord) ; seule la fraîcheur des prix du tableau de bord sert de sous-titre. `.impeccable/design.json` non régénéré (voir `/impeccable document`). Vérificateur : auto-contrôle inline (pas de sous-agent lancé).
- 2026-10-20 — Cadrage : référence manamancer.com analysée (CSS + captures), quatre décisions prises (portée, bannière, profondeur, titres). Plan créé.
