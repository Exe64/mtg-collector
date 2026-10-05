# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Un seul utilisateur réel : le propriétaire de l'application, collectionneur de cartes Magic: The Gathering, qui l'héberge lui-même. Le multi-compte existe (collections isolées, rôle admin) mais n'est pas utilisé par d'autres personnes aujourd'hui. Il ne faut pas concevoir pour un public d'inconnus, ni pour un parcours d'acquisition.

Trois situations d'usage, toutes fréquentes :

- **Au bureau, en session de tri** : cartes en main, import de lots, saisie, rangement par emplacement physique.
- **Sur téléphone, en déplacement** : en boutique ou en bourse, vérifier si une carte est possédée, dans quelle version, et son prix.
- **En consultation régulière** : coup d'œil au tableau de bord, aux mouvements de prix et aux alertes.

## Product Purpose

Magic Collection Manager inventorie et valorise une collection Magic: The Gathering. Il répond à trois questions à égalité, aucune ne domine : qu'est-ce que je possède exactement (version, finition, état, emplacement), combien cela vaut et comment la valeur évolue, et que me manque-t-il pour compléter une extension ou un deck.

Le succès, c'est un inventaire auquel on peut se fier sans rouvrir les classeurs, et une réponse obtenue en quelques secondes dans chacune des trois situations d'usage.

## Positioning

Un outil personnel auto-hébergé, taillé pour une seule collection, qui relie la carte numérique à son emplacement physique et suit les prix Cardmarket en euros. La saisie de masse est déléguée à une application de scan tierce (ManaBox) puis importée par CSV : le produit ne scanne pas lui-même.

## Operating Context

- Données cartes et prix issues de Scryfall (bulk-data, environ 90 000 cartes), prix Cardmarket EUR, avec USD en complément.
- Prix mis à jour toutes les 12 h (00:00 et 12:00 UTC) ; synchronisation hebdomadaire du catalogue.
- Onboarding de masse : scan dans ManaBox, export CSV, import, chaque lot étiqueté à un emplacement physique.
- Échanges avec Moxfield (import et export CSV, listes de deck collées, fichier `.txt` ou URL) et MTGO.
- PWA installable, coquille applicative disponible hors ligne.
- États de carte selon l'échelle Cardmarket (MT à PO).
- Interface en français, noms de cartes français disponibles.

## Capabilities and Constraints

Surfaces existantes : Tableau de bord, Collection, Ajouter, Extensions et détail d'extension, Mouvements de prix, Import/Export, Wishlist, Vérif deck, Alertes, Journal, Administration (comptes, état système), Connexion et Inscription, plus la modale de détail carte.

Contraintes techniques :

- Frontend React avec zustand, servi par nginx ; backend Express, PostgreSQL, Redis ; déploiement Docker Compose.
- CSP stricte (`script-src 'self'`) : pas de script en ligne ni de script tiers.
- Les images de cartes viennent de Scryfall.
- Les prix ne sont pas en temps réel : ils datent du dernier job.

Vocabulaire à conserver : extension (set), finition (normale / foil), état, emplacement, lot, complétion, numéros manquants, mouvements de prix, journal, wishlist.

Non décidé : ouverture éventuelle à d'autres utilisateurs.

## Brand Commitments

- Nom : Magic Collection Manager.
- Une illustration de bannière existe (cartes et gemmes).
- Produit non officiel, sans lien avec Wizards of the Coast.

## Evidence on Hand

- Données réelles : catalogue Scryfall, historique de prix par carte, snapshots de valeur de la collection.
- Référence API : `backend/API.md`. Liste des fonctionnalités : `README.md`.
- Absent, à ne pas inventer : témoignages, nombre d'utilisateurs, comparatifs, tarifs, mentions presse.

## Product Principles

1. **L'inventaire fait foi.** Une quantité, une version ou un emplacement affiché doit être exact ; toute modification est tracée au journal et annulable.
2. **Trois situations, un même produit.** Chaque écran doit rester utilisable en saisie dense au bureau comme à une main sur téléphone.
3. **Aucun axe ne prime.** Inventaire, valeur et complétion ont le même poids ; un écran ne sacrifie pas l'un pour mettre l'autre en scène.
4. **Un outil pour son propriétaire.** Pas de persuasion, pas d'explications de débutant, pas de parcours d'acquisition : la densité et la rapidité l'emportent.
5. **Dire la fraîcheur des données.** Un prix est toujours celui du dernier job, jamais présenté comme instantané.
