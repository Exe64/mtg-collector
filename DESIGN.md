---
name: Magic Collection Manager
description: Inventaire et valorisation d'une collection Magic, zinc chaud et sable doré, dense là où l'on compte, illustré là où l'on parcourt.
colors:
  zinc-fond: "#18181b"
  zinc-panneau: "#202024"
  zinc-releve: "#323238"
  zinc-bordure: "#45454c"
  filet: "rgba(255,255,255,0.06)"
  texte: "#e9e7e3"
  texte-fort: "#f7f6f4"
  texte-secondaire: "#bab6af"
  texte-attenue: "#a8a49d"
  texte-discret: "#8f8b84"
  bordure-champ: "#6e6c72"
  sable-action: "#b08a45"
  sable-survol: "#c8a45c"
  sable-signature: "#dec287"
  sable-clair: "#ebd9ae"
  sable-foil: "#d4b36f"
  sable-profond: "#8c6c36"
  bleu-valeur: "#00b4ff"
  bleu-jauge: "#0098e0"
  vert-hausse: "#34d399"
  rose-baisse: "#fb7185"
  rose-alerte: "#f43f5e"
  rose-danger: "#be123c"
  mana-blanc: "#e9e4c8"
  mana-bleu: "#4f8df0"
  mana-noir: "#6b6478"
  mana-rouge: "#e0483f"
  mana-vert: "#3aa45b"
  mana-incolore: "#9aa0a6"
  mana-multicolore: "#c9a227"
typography:
  display:
    fontFamily: "Cormorant SC, Georgia, serif"
    fontSize: "2.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Cormorant SC, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0.12em"
rounded:
  sm: "2px"
  base: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  tile: "16px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.sable-action}"
    textColor: "{colors.zinc-fond}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.sable-survol}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.sable-signature}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.zinc-releve}"
    textColor: "{colors.texte}"
    rounded: "{rounded.base}"
    padding: "4px 12px"
  button-danger:
    backgroundColor: "{colors.rose-danger}"
    textColor: "{colors.texte}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  input:
    backgroundColor: "{colors.zinc-panneau}"
    textColor: "{colors.texte}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  segment:
    backgroundColor: "{colors.zinc-fond}"
    textColor: "{colors.texte-attenue}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "4px"
  segment-active:
    textColor: "{colors.sable-clair}"
    rounded: "{rounded.md}"
  panel:
    backgroundColor: "{colors.zinc-panneau}"
    textColor: "{colors.texte}"
    rounded: "{rounded.xl}"
    padding: "16px"
  tile:
    backgroundColor: "{colors.zinc-panneau}"
    textColor: "{colors.texte}"
    rounded: "{rounded.tile}"
    padding: "12px"
  dialog:
    backgroundColor: "{colors.zinc-panneau}"
    textColor: "{colors.texte}"
    rounded: "{rounded.tile}"
    padding: "20px"
  nav-bar:
    backgroundColor: "{colors.zinc-fond}"
    textColor: "{colors.texte-attenue}"
    typography: "{typography.body}"
---

# Design System: Magic Collection Manager

## Overview

**Creative North Star : « La vitrine du collectionneur »**

Une vitrine de nuit : du zinc chaud, une dorure couleur sable, et les illustrations des cartes comme seule source de couleur vive. L'esprit vient de Manamancer (référence choisie le 2026-10-20), adapté à un outil d'inventaire. Les écrans que l'on parcourt (extensions, wishlist, grille d'une extension, fiche carte) laissent parler l'art des cartes. Les écrans où l'on compte (collection, journal, mouvements, import) restent des tableaux denses.

Le système est sombre et unique, sans variante claire : l'usage a lieu le soir au bureau, cartes en main, et en boutique sur téléphone.

**Key Characteristics :**
- Zinc chaud à trois paliers, filets blancs translucides à 6 %, sans gris froid.
- Un seul accent, le sable doré, décliné de 50 à 950.
- Titres en vraies petites capitales (Cormorant SC), tout le reste en Inter.
- Barre de navigation fine en verre dépoli, collante en haut d'écran.
- Tuiles arrondies à 16 px, portées par l'art des cartes ou par un symbole d'extension en filigrane.
- Bleu pour les euros, vert et rose pour les variations : ces règles de sens restent inchangées.

## Colors

Dans le code, les couleurs sont branchées sur des noms de classes Tailwind hérités qui ne décrivent pas leur teinte : `slate-*` est le zinc, `indigo-*` et `gold-*` sont le sable, `emerald-*` est le bleu, `gain-*` le vert de hausse. Le rose est celui de Tailwind par défaut.

### Primary
- **Sable d'action** (`indigo-600`) : fond des boutons principaux, libellé toujours en zinc fond. **Sable survol** (`indigo-500`) au survol.
- **Contour sable** (classe `.btn-outline`) : bordure sable à 70 %, texte sable signature, voile sable à 10 % au survol. Pour un appel mis en avant qui n'est pas l'action principale d'un formulaire.

### Secondary
- **Sable signature** (`gold-300`) : « MTG » du logotype, soulignement de l'onglet actif (`gold-400`), symbole d'une extension entamée, survol des titres de tuiles (`gold-200`).
- **Sable foil** (`gold-400`) : toute mention d'une quantité ou d'un prix foil.
- **Segment actif** : voile `gold-500` à 15 %, filet intérieur `gold-500` à 40 %, texte `gold-200`.

### Tertiary
- **Bleu valeur** (`emerald-400`) : montants en euros, courbes de valeur.
- **Bleu jauge** (`emerald-500`) : barres de complétion, pastille de quantité possédée, bordure d'une tuile possédée (à 70 %).
- **Vert hausse** (`gain-400`), **Rose baisse** (`rose-400`), **Rose alerte** (`rose-500`), **Rose danger** (`rose-700`) : comme avant.

### Neutral
- **Zinc fond** (`slate-900`, `#18181b`) : fond de page, base du verre dépoli.
- **Zinc panneau** (`slate-800`) : panneaux, tuiles, modales, champs. À 50 % pour les sections de tableau de bord.
- **Zinc relevé** (`slate-700`) : boutons secondaires, pistes de jauge.
- **Filet** (`white/[0.06]`) : contour de tout panneau, tuile ou section. `white/10` pour les séparateurs de la barre et les menus flottants.
- **Bordure de champ** (`edge`) : seul gris assez clair pour délimiter un contrôle (3:1). Passe en `gold-500` au focus.
- **Texte** (`slate-100`), **Texte fort** (`slate-50`, titres), **Texte secondaire** (`slate-300`), **Texte atténué** (`slate-400`), **Texte discret** (`slate-500`).

### Identité Magic
Les teintes `mana-*` (définies une seule fois, dans `src/constants.js`) colorent le liseré gauche d'une ligne de tableau (`identityStyle`) et le voile en haut d'une tuile de carte (`identityTint` : teinte à 22 % qui s'efface vers le bas).

### Named Rules
**La règle du sable unique.** Il n'y a qu'un accent. Le sable signe la navigation, les titres de tuile au survol et ce qui est foil ; plein, il ne sert qu'aux boutons d'action.

**La règle du chiffre bleu.** Un montant en euros est bleu. Rien d'autre n'est bleu, hormis les jauges de complétion et la marque « possédé ».

**La règle hausse / baisse.** Une hausse est verte, une baisse est rose, toujours précédées de leur signe.

## Typography

**Display Font :** Cormorant SC (repli Georgia, serif), graisses 500 et 600, auto-hébergée via `@fontsource/cormorant-sc`
**Body Font :** Inter (repli system-ui, sans-serif), graisses 400 à 700
**Symboles :** `mana-font` (coûts), `keyrune` (extensions), Lucide pour l'interface.

**Character :** une capitale romaine à empattements fins pour nommer, une linéale compacte pour lire et compter, et des libellés en capitales espacées pour structurer.

### Hierarchy
- **Display** (`.page-title` : Cormorant SC 600, 34 px, 28 px sur mobile, 44 px dans le hero du tableau de bord) : un titre de page par écran, en texte fort.
- **Headline** (Cormorant SC 600, 24 px) : nom de la carte dans la modale. 18 px pour le nom d'une tuile (extension, wishlist).
- **Logotype** (Cormorant SC 600, 22 px, interlettrage 0.04em) : « MTG » en sable, « Collector » en texte fort (masqué entre 640 et 1280 px). Même nom pour le titre d’onglet et la PWA.
- **Title** (Inter 600, 14 px, texte secondaire) : titre de section dans un panneau.
- **Body** (Inter 400, 14 px) : lignes de tableau, texte oracle, champs et boutons. Chiffres tabulaires partout.
- **Label** (Inter 500, 11 px, capitales, interlettrage 0.12em, texte atténué) : segments, libellés de statistiques, métadonnées de tuile (code, nombre de cartes, date).

### Named Rules
**La règle du titre gravé.** Cormorant SC nomme une page, une carte, une extension ou l'application. Jamais un bouton, un libellé ou un chiffre.

## Layout

Une colonne de contenu jusqu'à 1800 px (seul le fond du hero du tableau de bord va d'un bord à l'autre de la fenêtre), marges de 16 px (24 px à partir de 640 px), 24 à 32 px sous la barre. Pas de barre latérale.

- **Barre (≥ 640 px)** : 56 px, collante, en verre. Logotype, filet, puis deux groupes d'onglets séparés par un filet (inventaire : Tableau de bord, Collection, Ajouter ; valeur et complétion : Extensions, Mouvements, Wishlist, Vérif deck), puis le menu « Outils ». Libellés courts sous 1024 px, nom de l'utilisateur à partir de 1536 px.
- **Mobile (< 640 px)** : barre haute de 48 px (logotype, déconnexion) et barre d'onglets basse en verre, avec réserve de la zone sûre. Le contenu réserve 96 px en bas.
- **Hero du tableau de bord** : pleine largeur, fond fait des illustrations floutées (16 px, agrandies de 10 %) de 12 cartes tirées au hasard dans la collection à chaque visite (`/api/collection/hero-arts` ; rares et mythiques des 6 dernières extensions si la collection est vide), en fondu enchaîné (1,6 s, toutes les 7 s, figé si l'utilisateur réduit les animations). Centré : logotype « MTG Collector » (Cormorant SC 700, 38 à 72 px), filet–étoile–filet, devise « Collect with passion » (capitales espacées 0.35em, « passion » en sable), cinq pastilles WUBRG pastel qui s'allument selon l'identité de couleur de la carte affichée (un clic passe à la prochaine carte de cette couleur), puis la recherche de collection sur verre (raccourci « / », envoie vers `/collection?q=`) la fraîcheur des prix, et une pastille sur verre au nom de la carte affichée, qui l'ouvre. Les statistiques chevauchent son bas, sur verre.
- **Connexion / création de compte** (`AuthShell`) : on doit se croire dans l'espace. Fond `slate-950`, nébuleuses WUBRG très légères (5 dégradés radiaux, 3,5 à 7 %), puis ciel sur `<canvas>` (`Starfield`) : 220 à 900 étoiles selon la surface, 72 % aux couleurs WUBRG, chacune à une profondeur qui fixe sa taille, son éclat, sa dérive d'ensemble (lente, vers le bas à droite), sa parallaxe au pointeur et sa fuite devant lui (rayon 140 px) ; halos en sprites pré-rendus, scintillement ; immobile si l'utilisateur réduit les animations. Logotype compact (`Wordmark size="sm"`), carte vitrée de 352 px, champs à texte centré, bouton contour sable ; pied « projet non officiel ».
- **Grilles de tuiles** : 1, 2, 3, 4 puis 5 colonnes (extensions, wishlist), 2 à 8 colonnes pour les cartes d'une extension, écart de 12 px.

## Elevation & Depth

La profondeur vient de trois paliers de zinc, des filets translucides et, avec mesure, du verre dépoli.

### Verre (`.glass`)
Zinc fond à 70 %, flou de 24 px, saturation à 150 %. Réservé à ce qui flotte au-dessus d'une image ou du contenu : barres de navigation, menu « Outils », statistiques du hero, pastilles posées sur l'art (prix, retrait). Un panneau de données n'est jamais en verre.

### Shadow Vocabulary
- **Flottant** (`shadow-2xl shadow-black/50`) : menu « Outils », modales.
- **Objet** (`shadow-xl shadow-black/50`) : image de carte dans la modale.
- **Pastille** (`shadow-md shadow-black/40`) : quantité posée sur une carte.

Le voile des modales est noir à 60 %, flouté à 6 px.

### Named Rules
**La règle du verre utile.** Le flou ne décore pas : il sépare un élément flottant de ce qu'il recouvre. Pas de verre sur fond uni.

## Shapes

Le rayon grandit avec l'objet : 4 px pour les petits boutons, 6 px pour les boutons, 8 px pour les champs et pistes de segments, 12 px pour les panneaux et sections, 16 px pour les tuiles et les modales. Les images de cartes gardent le rayon des vraies cartes (`4.75% / 3.5%`). Le cercle complet est réservé aux badges, pastilles et jauges.

L'onglet actif est souligné d'un trait sable de 2 px aux bouts arrondis. Le liseré d'identité des lignes de tableau fait 4 px, à gauche.

## Components

### Buttons
- **Principal :** sable d'action, libellé zinc fond, 8 × 16 px, rayon 6 px.
- **Contour :** `.btn-outline`, mêmes proportions.
- **Secondaire :** zinc relevé, 4 × 12 px, rayon 4 px.
- **Destructif :** rose danger.
- **Déconnexion :** bouton à filet `white/10`, icône et libellé atténués, rose au survol.

### Segments
`.seg` (piste zinc fond à 60 %, filet, rayon 8 px, 4 px de marge) contenant des `.seg-btn` (libellé en capitales espacées, 11 px). Le segment actif ajoute `.seg-btn-on` et porte `aria-pressed`.

### Panneaux et sections
- **Panneau :** zinc panneau, filet, rayon 12 px, 12 à 16 px de marge.
- **Section :** zinc panneau à 50 %, filet, rayon 12 px, 16 px de marge.

### Tuiles
- **Carte d'une extension :** image de carte entière dans un cadre de 6 px, voile d'identité en haut, pastille de quantité en bleu jauge. Non possédée : opacité 50 %, saturation 50 %.
- **Wishlist :** illustration recadrée (`artCrop`, Scryfall `art_crop`) en 16/9, fondue vers le zinc, nom en Cormorant SC qui chevauche l'image, pastille de prix et bouton de retrait sur verre.
- **Extension :** dégradé zinc, symbole keyrune en filigrane à 5 % dans le coin, symbole en sable si l'extension est entamée, jauge de complétion.

### Inputs / Fields
Zinc panneau, bordure de champ, rayon 8 px (6 px pour les champs compacts), bordure sable au focus, contour sable de 2 px au focus clavier. Placeholder en texte discret. Sous 640 px, texte à 16 px.

### Navigation
Voir Layout. Onglet inactif en texte atténué, actif en texte fort souligné de sable. Badge de notifications rose alerte, 14 px.

### Modale de carte
Rayon 16 px, filet, ombre flottante. En tête, l'illustration de la carte floutée à 40 % se fond dans le zinc. Image de la carte à gauche (256 px) au-delà de 768 px, au-dessus en dessous. Toute modale passe par `Modal` (`<dialog>` natif).

## Do's and Don'ts

### Do:
- **Do** laisser l'art des cartes porter la couleur des écrans de parcours, et garder les tableaux denses là où l'on compte.
- **Do** utiliser `.page-title`, `.seg`, `.glass` et `.btn-outline` plutôt que de recomposer ces styles.
- **Do** dériver l'illustration avec `artCrop()` : aucune URL supplémentaire à stocker.
- **Do** afficher tout montant en euros en bleu, toute hausse en vert précédée de « + », toute baisse en rose.
- **Do** garder les icônes Lucide pour toute action, sans glyphe ni emoji.
- **Do** passer `npm run check:contrast` après tout changement de palette.

### Don't:
- **Don't** mettre en verre un panneau de données ou un élément posé sur fond uni.
- **Don't** utiliser Cormorant SC pour un bouton, un libellé ou un chiffre.
- **Don't** introduire un second accent : le sable est seul.
- **Don't** utiliser le bleu pour autre chose qu'un montant, une jauge ou la marque « possédé ».
- **Don't** se fier au nom des classes pour deviner une teinte : `slate` est zinc, `indigo` est sable, `emerald` est bleu.
- **Don't** utiliser de nuance absente de `tailwind.config.js`.
- **Don't** ajouter de parchemin, de texture ou de cadre orné : l'univers Magic passe par l'art des cartes, les symboles et la typographie.
