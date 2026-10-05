---
name: Magic Collection Manager
description: Inventaire et valorisation d'une collection Magic, sombre, dense et utilitaire.
colors:
  anthracite-fond: "#17181a"
  anthracite-panneau: "#202225"
  anthracite-releve: "#2c2f33"
  anthracite-bordure: "#3a3e44"
  texte: "#e8eaed"
  texte-secondaire: "#b4bac1"
  texte-attenue: "#a0a6ae"
  texte-discret: "#868c95"
  bordure-champ: "#6b7179"
  ambre-action: "#a87f2e"
  ambre-survol: "#c2953a"
  ambre-lien: "#e3c178"
  or-signature: "#e8cd8a"
  or-foil: "#d9b85f"
  or-profond: "#8a6824"
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
    fontFamily: "Cinzel, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.025em"
  headline:
    fontFamily: "Cinzel, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
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
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  sm: "2px"
  base: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "12": "48px"
components:
  button-primary:
    backgroundColor: "{colors.ambre-action}"
    textColor: "{colors.anthracite-fond}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.ambre-survol}"
  button-secondary:
    backgroundColor: "{colors.anthracite-releve}"
    textColor: "{colors.texte}"
    rounded: "{rounded.base}"
    padding: "4px 12px"
  button-secondary-hover:
    backgroundColor: "{colors.anthracite-bordure}"
  button-danger:
    backgroundColor: "{colors.rose-danger}"
    textColor: "{colors.texte}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  input:
    backgroundColor: "{colors.anthracite-fond}"
    textColor: "{colors.texte}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  input-inline:
    backgroundColor: "{colors.anthracite-fond}"
    textColor: "{colors.texte}"
    typography: "{typography.label}"
    rounded: "{rounded.base}"
    padding: "2px 4px"
  panel:
    backgroundColor: "{colors.anthracite-panneau}"
    textColor: "{colors.texte}"
    rounded: "{rounded.lg}"
    padding: "12px"
  dialog:
    backgroundColor: "{colors.anthracite-panneau}"
    textColor: "{colors.texte}"
    rounded: "{rounded.xl}"
    padding: "16px"
  nav-tab:
    backgroundColor: "{colors.anthracite-panneau}"
    textColor: "{colors.texte-secondaire}"
    typography: "{typography.body}"
    padding: "12px 16px"
  nav-tab-active:
    textColor: "{colors.or-signature}"
  segment:
    backgroundColor: "{colors.anthracite-panneau}"
    textColor: "{colors.texte-secondaire}"
    rounded: "{rounded.base}"
    padding: "6px 16px"
  segment-active:
    backgroundColor: "{colors.or-profond}"
    textColor: "#ffffff"
---

# Design System: Magic Collection Manager

## Overview

**Creative North Star: "Le Registre du collectionneur"**

Un livre de comptes tenu par quelqu'un qui connaît sa collection. L'interface est un fond anthracite neutre sur lequel s'alignent des lignes denses : noms de cartes, codes d'extension, quantités, prix. L'or n'apparaît que là où un registre mettrait une dorure : le titre de la page et l'onglet actif. Tout le reste est au service de la lecture rapide et de la saisie.

La densité est assumée. Le texte courant est petit (14 px), les libellés plus petits encore (12 px), les marges internes serrées (8 à 16 px). Les composants sont compacts et utilitaires : plats, sans ombre, sans animation, ils ne cherchent pas à se faire remarquer. La seule image riche est celle des cartes elles-mêmes, plus la bannière illustrée en tête d'application.

Le rejet confirmé est la fantasy surchargée : pas de parchemin, pas de texture, pas de cadre orné, pas de lueur. L'univers Magic passe par la typographie gravée des titres, les symboles de mana et d'extension, et les illustrations des cartes, jamais par un décor.

**Key Characteristics:**
- Thème sombre unique, anthracite neutre, sans variante claire.
- Or réservé aux titres et aux états actifs ; ambre pour les actions.
- Bleu vif exclusivement pour les valeurs monétaires et les jauges de complétion.
- Surfaces plates, hiérarchie par paliers de gris et filets d'un pixel.
- Texte petit, lignes serrées, tableaux et listes plutôt que cartes.

## Colors

Une palette de charbon neutre portée par trois accents qui ont chacun un seul métier : l'or signe, l'ambre agit, le bleu chiffre.

Dans le code, ces couleurs sont branchées sur des noms de classes Tailwind hérités qui ne décrivent plus leur teinte : `slate-*` est l'anthracite, `indigo-*` est l'ambre, `emerald-*` est le bleu, `gold-*` l'or, `gain-*` le vert de hausse. Le rose est celui de Tailwind par défaut.

### Primary
- **Ambre d'action** (`ambre-action`, classe `indigo-600`) : fond des boutons principaux, du bouton flottant de retour en haut. Le libellé posé dessus est toujours en anthracite fond, jamais en clair. Passe à **Ambre survol** (`indigo-500`) au survol, qui sert aussi aux jauges de répartition de valeur.
- **Ambre lien** (`ambre-lien`, `indigo-300`) : couleur de survol des noms de cartes cliquables et pastille de notification non lue (`indigo-400`).

### Secondary
- **Or signature** (`or-signature`, `gold-300`) : titre de l'application dans la bannière, onglet de navigation actif, texte des encarts d'information.
- **Or foil** (`or-foil`, `gold-400`) : toute mention d'une quantité ou d'un prix foil.
- **Or profond** (`or-profond`, `gold-700`) : fond du segment sélectionné dans un sélecteur à segments, bordure des encarts d'information.

### Tertiary
- **Bleu valeur** (`bleu-valeur`, `emerald-400`) : valeur de la collection, prix en euros, courbes d'évolution.
- **Bleu jauge** (`bleu-jauge`, `emerald-500`) : remplissage des barres de complétion d'extension, pastille d'état « OK », badge de quantité possédée.
- **Vert hausse** (`vert-hausse`, `gain-400`) : variations de prix positives, et rien d'autre.
- **Rose baisse** (`rose-baisse`, `rose-400`) : variations négatives, messages d'erreur, lien de déconnexion.
- **Rose alerte** (`rose-alerte`, `rose-500`) : badge du compteur de notifications. **Rose danger** (`rose-danger`, `rose-700`) : fond des boutons destructifs.

### Neutral
- **Anthracite fond** (`slate-900`) : fond de page, fond des champs de saisie (un champ est un creux dans son panneau).
- **Anthracite panneau** (`slate-800`) : barres de navigation, panneaux, modales. À 40 % d'opacité pour les sections secondaires.
- **Anthracite relevé** (`slate-700`) : boutons secondaires, barre d'actions collante, bordure des panneaux.
- **Bordure de champ** (`edge`) : contour des champs de saisie et des listes déroulantes, seul gris assez clair pour délimiter un contrôle (3:1).
- **Anthracite bordure** (`slate-600`) : survol des boutons secondaires, bordures plus marquées.
- **Texte** (`slate-100`), **Texte secondaire** (`slate-300`, titres de section), **Texte atténué** (`slate-400`, libellés et métadonnées), **Texte discret** (`slate-500`, codes d'extension, dates, états vides).

### Identité Magic
Les sept teintes `mana-*` (définies une seule fois, dans `src/constants.js`) colorent le liseré gauche d'une ligne de carte (ombre interne de 4 px) selon son identité de couleur, et l'anneau de répartition par couleur. Les anneaux par rareté, type et état gardent leurs propres teintes par catégorie.

### Named Rules
**La règle de la dorure.** L'or ne colore jamais un bouton d'action ni un chiffre. Il marque le titre, l'onglet où l'on se trouve et ce qui est foil.

**La règle du chiffre bleu.** Un montant en euros est bleu. Rien d'autre n'est bleu, hormis les jauges de complétion.

**La règle hausse / baisse.** Le vert et le rose appartiennent aux variations de prix. Une hausse est verte, une baisse est rose, toujours précédées de leur signe.

## Typography

**Display Font:** Cinzel (repli Georgia, serif), graisses 600 et 700
**Body Font:** Inter (repli system-ui, sans-serif), graisses 400 à 700
**Symboles :** polices d'icônes `mana-font` (coûts de mana) et `keyrune` (symboles d'extension) ; icônes d'interface Lucide en 16 à 20 px.

**Character:** Une capitale romaine gravée pour nommer les choses, une linéale neutre et compacte pour tout ce qui se lit et se compte. Le contraste entre les deux est le seul geste typographique du système.

### Hierarchy
- **Display** (Cinzel 700, 30 px, 20 px sur mobile, interlettrage 0.025em) : titre de l'application dans la bannière, en or signature.
- **Headline** (Cinzel 700, 20 px) : titre de page, un seul par écran. 18 px pour le nom de la carte dans la modale.
- **Title** (Inter 600, 14 px, texte secondaire) : titre de section à l'intérieur d'un panneau.
- **Body** (Inter 400, 14 px, interligne 20 px) : lignes de tableau, texte oracle, champs et boutons.
- **Label** (Inter 400, 12 px, texte atténué) : libellés de statistiques, métadonnées, codes d'extension en capitales. 10 à 11 px pour les libellés de la barre d'onglets mobile.

Les valeurs mises en avant (statistiques du tableau de bord) sont en Inter 700, 18 px.

### Named Rules
**La règle du titre gravé.** Cinzel nomme une page ou une carte, jamais un bouton, un libellé ou un chiffre.

## Layout

Une seule colonne de contenu, pleine largeur jusqu'à 1800 px, avec 16 px de marge. Pas de barre latérale : la navigation est horizontale sous la bannière sur ordinateur, et devient une barre d'onglets fixe en bas de l'écran sous 640 px, avec une feuille « Plus » pour les outils secondaires.

Le rythme vertical d'une page est de 20 px entre sections. Les grilles se resserrent par paliers : les statistiques passent de 2 à 3 puis 5 colonnes (640 px, 1024 px), les blocs doubles s'empilent sous 768 px. L'écart de grille standard est de 8 px, 16 px entre deux blocs de contenu.

La bannière fait 96 px de haut sur mobile et 144 px au-delà. Son image est calée à gauche et son fond se confond avec celui de la page ; un dégradé vers le bas assure la lisibilité du titre.

Sur mobile, le contenu réserve 96 px en bas pour la barre d'onglets. La modale de carte empile l'image au-dessus du texte sous 768 px et les place côte à côte au-delà (image de 256 px de large).

## Elevation & Depth

Le système est plat. La profondeur vient de trois paliers d'anthracite (fond, panneau, relevé) et de filets d'un pixel, pas d'ombres. Un champ de saisie est plus sombre que le panneau qui le porte ; un bouton secondaire est plus clair.

### Shadow Vocabulary
- **Flottant** (`shadow-lg`) : bouton rond de retour en haut, ombre portée du titre de bannière.
- **Menu** (`shadow-xl`) : menu déroulant « Outils ».

Les modales n'ont pas d'ombre : elles se détachent par un voile noir à 70 % (50 % pour la feuille mobile).

### Named Rules
**La règle du plat.** Un panneau, une ligne ou un bouton n'a jamais d'ombre. Seul ce qui flotte au-dessus du contenu en porte une.

## Shapes

Des angles à peine adoucis, dont le rayon grandit avec la taille de l'objet : 2 px pour les vignettes de carte et les pastilles de légende, 4 px pour les petits boutons et les champs en ligne, 6 px pour les boutons et champs standards, 8 px pour les panneaux et l'image de carte, 12 px pour les modales, 16 px en haut de la feuille mobile. Le cercle complet est réservé aux badges, pastilles d'état, jauges et au bouton flottant.

Les bordures font toujours 1 px, en anthracite relevé ou plus sombre pour les surfaces, en bordure de champ pour les contrôles de saisie. L'onglet actif est souligné d'un trait de 2 px en ambre. Le liseré d'identité de couleur fait 4 px, sur le bord gauche.

## Components

### Buttons
Petits, plats, sans bordure, texte de 14 px. Aucune transition : le survol change la teinte d'un palier.
- **Principal :** ambre d'action avec libellé anthracite, rayon 6 px, marges 8 × 16 px ; ambre survol au survol ; 50 % d'opacité quand désactivé. Version compacte en 4 × 12 px, rayon 4 px, à l'intérieur d'une ligne.
- **Secondaire :** anthracite relevé, rayon 4 px, marges 4 × 12 px ; anthracite bordure au survol.
- **Destructif :** rose danger, mêmes proportions que le principal.
- **Texte :** sans fond, texte atténué qui blanchit au survol (fermeture, liens discrets) ou rose pour la déconnexion.

### Segments
Sélecteur à segments pour les périodes et les regroupements : boutons de 14 px, rayon 4 px. Le segment sélectionné est en or profond avec texte blanc ; les autres en anthracite panneau.

### Cards / Containers
- **Panneau :** anthracite panneau, bordure anthracite relevé, rayon 8 px, marge interne 12 px (statistique) ou 16 px.
- **Section :** anthracite panneau à 40 %, bordure plus sombre, rayon 8 px, marge 16 px. C'est le conteneur par défaut d'un bloc de tableau de bord.
- **Encart d'information :** bordure or profond translucide, texte or clair.
- **Message d'erreur :** texte rose baisse sur fond rose très sombre translucide, rayon 4 px, marge 8 px.

### Inputs / Fields
- **Standard :** fond anthracite fond, bordure de champ, rayon 6 px, marges 8 × 12 px, texte 14 px.
- **En ligne :** même principe en 12 px, rayon 4 px, marges 2 × 4 px, pour l'édition d'une quantité dans un tableau.
- **Focus :** contour or foil de 2 px, décalé de 2 px, sur tout élément atteint au clavier (`:focus-visible`). Sous 640 px, le texte des champs passe à 16 px pour éviter le zoom de Safari iOS.
- **Désactivé :** 50 % d'opacité.

### Tables and Lists
Tableaux pleine largeur en 14 px, cellules à 8 px de marge, en-têtes alignés comme leurs colonnes (texte à gauche, chiffres à droite). Les lignes sont séparées par un filet d'un pixel et s'éclaircissent légèrement au survol. Un nom de carte est un bouton texte qui ouvre la modale de détail ; il est suivi du code d'extension en capitales, en texte discret.

### Navigation
- **Ordinateur :** barre horizontale en anthracite panneau, onglets de 14 px avec icône de 16 px. L'onglet actif passe en or signature avec un soulignement ambre de 2 px ; les autres s'éclaircissent au survol.
- **Mobile :** barre fixe en bas, icône de 18 px au-dessus d'un libellé court de 10 px. L'onglet actif est en or signature, sans soulignement.
- **Badge :** compteur rond rose alerte, 14 px, accroché à l'icône.

### Jauge
Piste arrondie de 4 ou 8 px de haut en anthracite, remplie en bleu jauge pour la complétion d'une extension, en ambre survol pour une répartition de valeur.

### Modale de carte
Panneau de 768 px de large au plus, 90 % de la hauteur d'écran, défilant. Image de la carte à gauche, puis nom en Cinzel, coût de mana en symboles, ligne de type, texte oracle, prix, quantités possédées, autres éditions, actions, courbe de prix et rulings. Se ferme par la croix, la touche Échap ou un clic sur le voile. Toute modale passe par le composant `Modal`, qui s'appuie sur l'élément natif `<dialog>` : le focus y reste enfermé et revient à son point de départ à la fermeture.

## Do's and Don'ts

### Do:
- **Do** garder le texte courant à 14 px et les libellés à 12 px : la densité est une qualité de ce produit.
- **Do** réserver Cinzel aux titres de page et aux noms de carte, en graisse 700.
- **Do** afficher tout montant en euros en bleu valeur, toute hausse en vert précédée de « + », toute baisse en rose.
- **Do** marquer ce qui est foil en or foil.
- **Do** utiliser les icônes Lucide pour toute nouvelle action, pas de glyphe ni d'emoji.
- **Do** construire la profondeur avec les trois paliers d'anthracite et des filets d'un pixel.
- **Do** aligner les chiffres à droite dans les tableaux.
- **Do** prévoir chaque écran pour la barre d'onglets mobile : 96 px de réserve en bas, grilles qui s'empilent sous 640 px.

### Don't:
- **Don't** ajouter de parchemin, de texture, de cadre orné, de lueur ou de dégradé décoratif : la fantasy surchargée est le rejet confirmé.
- **Don't** utiliser l'or pour un bouton d'action ou un chiffre.
- **Don't** utiliser le bleu pour autre chose qu'un montant ou une jauge de complétion.
- **Don't** poser d'ombre sur un panneau, une ligne ou un bouton.
- **Don't** se fier au nom des classes pour deviner une teinte : `indigo` est ambre, `emerald` est bleu.
- **Don't** utiliser de nuance absente de `tailwind.config.js` : elle ne produit rien, ou retombe sur la teinte par défaut de Tailwind (violet pour `indigo`, vert pour `emerald`).
- **Don't** poser de texte clair sur l'ambre, ni de texte `slate-600` ou plus sombre sur un fond anthracite. `npm run check:contrast` vérifie les paires de la palette.
