# API REST — Magic Collection Manager

Base : `/api`. Publiques : `/api/auth/login|register|refresh|setup-status` et `/api/health`.
Toutes les autres exigent l'en-tête `Authorization: Bearer <accessToken>`. Les routes
marquées **(admin)** exigent un compte administrateur. Le refresh token circule en cookie httpOnly.

## Santé
| Méthode | Route | Réponse |
|---|---|---|
| GET | `/api/health` | `{ status, db, redis }` |

## Authentification
| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| GET | `/api/auth/setup-status` | — | `{ needsSetup }` (public) |
| POST | `/api/auth/register` | `{ email, password, display_name? }` | `{ user, accessToken }` + cookie — **1er compte uniquement** |
| POST | `/api/auth/login` | `{ email, password, code? }` | `{ user, accessToken }` + cookie — `{ mfaRequired: true }` si MFA activé sans `code` |
| POST | `/api/auth/refresh` | — (cookie) | `{ accessToken }` (rotation + détection de réutilisation → révocation de la lignée) |
| POST | `/api/auth/logout` | — (cookie) | `204` |
| GET | `/api/auth/me` | — | `{ user }` |
| GET | `/api/auth/users` | — | `{ users[] }` **(admin)** |
| POST | `/api/auth/users` | `{ email, password, display_name?, is_admin? }` | `{ user }` **(admin)** |
| DELETE | `/api/auth/users/:id` | — | `204` **(admin)** |
| GET | `/api/auth/mfa` | — | `{ enabled, backupCodesRemaining }` |
| POST | `/api/auth/mfa/setup` | — | `{ secret, otpauth, qr }` (QR en data-URL, non activé tant que non confirmé) |
| POST | `/api/auth/mfa/enable` | `{ code }` | `{ backupCodes[] }` (10 codes à usage unique, affichés une seule fois) |
| POST | `/api/auth/mfa/disable` | `{ code }` | `204` (code TOTP ou de secours exigé) |

Mot de passe : ≥ 8 caractères, 1 majuscule, 1 chiffre. Access token 30 min. Rate limit auth : 10 req / 15 min / IP.
MFA : TOTP (RFC 6238, ±30 s), opt-in par utilisateur ; un code de secours consommé est retiré de la liste.

## Cartes
| Méthode | Route | Params | Réponse |
|---|---|---|---|
| GET | `/api/cards/search` | `q`, `set?`, `page?`, `unique=cards\|prints` | `{ cards[], total, page, hasMore }` |
| GET | `/api/cards/prints` | `name` | `{ cards[] }` (toutes les éditions) |
| GET | `/api/cards/:scryfallId` | — | `{ card }` (DB-first + lazy upsert) |
| GET | `/api/cards/:scryfallId/rulings` | — | `{ rulings[] }` (source Wizards/Gatherer) |
| GET | `/api/cards/:scryfallId/price-history` | — | `{ history[] }` (courbe de prix par carte) |

## Extensions
| Méthode | Route | Params | Réponse |
|---|---|---|---|
| GET | `/api/sets` | `type?` | `{ sets[] }` |
| GET | `/api/sets/:code` | — | `{ set }` (détail d'une extension) |
| GET | `/api/sets/:code/cards` | `page?` | `{ cards[], total, page, hasMore }` |

## Collection (isolée par utilisateur)
| Méthode | Route | Params / Corps | Réponse |
|---|---|---|---|
| GET | `/api/collection` | `q, set, color, type, rarity, condition, finish, language, location, cmc, cmcMin, cmcMax, sort, order, page, pageSize` | `{ entries[], total, page, pageSize, stats }` |
| GET | `/api/collection/groups` | `by=set\|color\|rarity\|location` + mêmes filtres | `{ by, groups[], stats }` |
| GET | `/api/collection/stats` | — | `{ pricesUpdatedAt, totalValue, cardCount, uniqueCardCount, setCount, profitability, topCards[], colorBreakdown, rarityBreakdown, conditionBreakdown, typeBreakdown, valueBreakdown }` |
| GET | `/api/collection/snapshots` | `days?` | `{ snapshots[] }` |
| GET | `/api/collection/set-snapshots` | `set, days?` | `{ snapshots[] }` (courbe de valeur d'une édition) |
| GET | `/api/collection/price-movers` | `days?=7, threshold?=20, limit?=10` | `{ gainers[], losers[], spikes[] }` (hausses/baisses en € + variations ≥ threshold %, les `limit` plus fortes) |
| GET | `/api/collection/log` | `days?=30` | `{ log[] }` (journal des ajouts/retraits : delta signé, finition, source, date, `undoable`) |
| POST | `/api/collection/log/:id/undo` | — | `{ applied }` (réapplique le delta inverse sur la même variante) |
| GET | `/api/collection/locations` | — | `{ locations[] }` (emplacements physiques distincts) |
| GET | `/api/collection/owned-by-set` | — | `{ ownedBySet: { <code>: { owned, value } } }` |
| GET | `/api/collection/hero-arts` | `limit?=12` (1–30) | `{ source: collection\|catalog, cards: [{ scryfall_id, name, image_uri_small, color_identity }] }` (cartes au hasard pour les fonds du tableau de bord ; rares/mythiques des 6 dernières extensions si la collection est vide) |
| GET | `/api/collection/owned` | `set?` | `{ owned: { <scryfall_id>: { nonfoil, foil } }, totalEur }` |
| GET | `/api/collection/printings/:scryfallId` | — | `{ printings: [{ scryfall_id, set_code, set_name, collector_number, nonfoil, foil }] }` (impressions possédées de la même carte) |
| POST | `/api/collection/owned-ids` | `{ ids[] }` (UUID) | `{ owned: { <scryfall_id>: { nonfoil, foil } } }` |
| POST | `/api/collection` | `{ scryfall_id, quantity, finish, condition, language, acquired_price?, notes? }` | `{ entry }` (incrément sur conflit) |
| POST | `/api/collection/adjust` | `{ scryfall_id, delta, finish?, condition?, language?, location? }` | `{ quantity }` |
| POST | `/api/collection/bulk` | `{ ids[], patch:{ finish?, condition?, language?, location? } }` | `{ updated, conflicts }` |
| PATCH | `/api/collection/:id` | `{ quantity?, finish?, condition?, language?, notes?, acquired_price?, acquired_at? }` | `{ entry }` / `409` si conflit |
| DELETE | `/api/collection/:id` | — | `204` |

Conditions : `MT, NM, EX, GD, LP, PL, PO`. Finitions : `nonfoil, foil, etched`.
`location` : emplacement physique (fait partie de la clé d'unicité de l'entrée).

## Decks et Vérif deck
| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| POST | `/api/decks/check` | `{ url }` (Moxfield) **ou** `{ text }` (liste Moxfield/MTGO) | `{ cards[], summary }` (cartes manquantes vs collection, comparaison par nom ; chaque carte porte ses versions possédées ; le « peut-être » est ignoré) |
| GET | `/api/decks` | — | `{ decks[{ id, name, format, notes, cover, commanders[], color_identity[], count, pct }] }` (`pct` : % possédé en exemplaires hors terrains de base, `null` si vide) |
| POST | `/api/decks` | `{ name?, format?, notes?, url? \| text? }` | `201 { id, unknown[] }` (deck vide ou importé ; sections Commander / Sideboard / Maybeboard reconnues ; noms non reconnus dans `unknown`) |
| GET | `/api/decks/by-card/:scryfallId` | — | `{ decks[{ id, name }] }` (decks du compte qui utilisent la carte, par nom) |
| GET | `/api/decks/:id` | — | `{ deck, cards[], summary, issues[] }` : lignes (`zone`, `qty`, impression, `finish`, `owned`, `missing`, `cheapest_eur`, `used_in[]`), `summary { count, pct, missingDistinct, missingTotal, missingEur, valueEur }`, contrôles `issues[{ level: error\|warn, message, cards[] }]` |
| PATCH | `/api/decks/:id` | `{ name?, format?, notes?, cover_scryfall_id? }` | `{ ok }` (`cover_scryfall_id` : image de fond choisie, `null` = commandant, sinon la carte la plus chère ; la fiche renvoie `deck.cover`) |
| DELETE | `/api/decks/:id` | — | `204` |
| POST | `/api/decks/:id/cards` | `{ name? \| scryfall_id?, quantity?, zone? }` | `201` (s'additionne à la ligne existante ; par `name`, impression possédée sinon la moins chère) |
| PATCH | `/api/decks/:id/cards/:lineId` | `{ quantity?, zone?, scryfall_id? }` | `{ ok }` (vers une ligne existante : quantités fusionnées) |
| DELETE | `/api/decks/:id/cards/:lineId` | — | `204` |
| GET | `/api/decks/:id/cards/:lineId/printings` | — | `{ printings[{ scryfall_id, set_code, set_name, collector_number, eur, owned }] }` |
| POST | `/api/decks/:id/missing-to-wishlist` | — | `{ added, missing }` |

Formats : clés des légalités Scryfall (`commander`, `modern`, `vintage`…) ou `casual` (aucun contrôle). Zones : `commander, main, side, maybe` ; seules `commander` et `main` comptent (taille, possession, coût, valeur). Un deck ne réserve aucun exemplaire et ne touche jamais la collection. Import : une ligne `1 Nom (SET) numéro *F*` garde cette impression et sa finition (`*F*` foil, `*E*` etched ; Moxfield idem) ; sans édition ou impression inconnue, l'exemplaire possédé, sinon le moins cher. La valeur d'une ligne foil suit le prix foil.

## Commandants (« Trouver un commandant »)
| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| GET | `/api/commanders` | — | `{ commanders[], owned[] }` : catalogue légal (1 ligne par `oracle_id`, impression la moins chère en €, `rank`/`num_decks` EDHREC, `pairing`), et `oracle_id` des légendes possédées |
| GET | `/api/commanders/collection` | — | `{ commanders[{ oracle_id, status: ready\|pending\|unavailable, coverage }], pending, running }` (deck moyen EDHREC lu en cache ; s'il en manque, lance le job de fond) |
| GET | `/api/commanders/themes` | — | `{ themes[{ slug, name, numDecks }] }` (≈ 410 thèmes EDHREC) |
| GET | `/api/commanders/themes/:slug` | — | `{ commanders[{ oracle_id, numDecks }] }` (commandants phares du thème) |
| GET | `/api/commanders/shortlist` | — | `{ shortlist[], max: 4 }` |
| POST | `/api/commanders/shortlist` | `{ oracle_id }` | `201` / `409` (présélection pleine) |
| DELETE | `/api/commanders/shortlist/:oracleId` | — | `204` |
| GET | `/api/commanders/:oracleId` | — | `{ commander, edhrec, coverage, deck[], combos[], unavailable[] }` (fiche : thèmes, cartes principales et similaires, couverture et decklist complète du deck moyen `{ name, qty, owned, eur, type_line, basic }`, combos Commander Spellbook avec pièces possédées) |
| GET | `/api/commanders/:oracleId/deck` | `theme?`, `bracket?` (`exhibition\|core\|upgraded\|optimized\|cedh`), `budget?` (`budget\|expensive`) | `{ deck[], coverage, numDecks }` (variante du deck moyen EDHREC ; `deck: null` si la combinaison n'existe pas) |
| POST | `/api/commanders/:oracleId/build` | `theme?`, `bracket?`, `budget?` (query) ; `{ name? }` | `201 { id, unknown[] }` (« Construire avec » : deck Commander créé depuis le deck moyen ou la variante) |
| POST | `/api/commanders/:oracleId/missing-to-wishlist` | `theme?`, `bracket?`, `budget?` (query) | `{ added, missing }` (manquantes du deck moyen, ou de la variante, en wishlist ; impression la moins chère) |

Données externes (API non officielles EDHREC, publique Commander Spellbook) mises en cache en base (`external_cache`, 7 jours), appels limités à ~1/s. Job de fond `commander-cache` chaque nuit (05:30 UTC) : classement des commandants, pages et decks moyens des légendes possédées, thèmes. Si un service ne répond pas, la copie périmée est servie, sinon `unavailable` le signale.

## Import
| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| POST | `/api/import/csv` | `multipart: file, mode=merge\|replace, location?, dryRun?` | `{ imported, skipped, errors[] }` ou `{ dryRun, total, resolvedLocally, needsScryfall, invalid, samples }` |

Plafond : 20 000 lignes par import. Mode `replace` transactionnel (rollback en cas d'échec).

## Wishlist
| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| GET | `/api/wishlist` | — | `{ items[], totalEur }` |
| GET | `/api/wishlist/movers` | `days?=7` | `{ movers[] }` (variations de prix des cartes en wishlist, baisses en tête) |
| POST | `/api/wishlist` | `{ scryfall_id, note? }` | `{ id }` |
| DELETE | `/api/wishlist/:id` | — | `204` |

## Alertes de prix & notifications
| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| GET | `/api/alerts` | — | `{ alerts[] }` |
| POST | `/api/alerts` | `{ scryfall_id, direction: below\|above, threshold_eur }` | `{ id }` (réarme sur conflit) |
| DELETE | `/api/alerts/:id` | — | `204` |
| GET | `/api/alerts/notifications` | — | `{ notifications[], unread }` |
| POST | `/api/alerts/notifications/read` | `{ id? }` | `204` (marque lue(s)) |

Les alertes sont évaluées par le job quotidien après la MAJ des prix : seuil franchi → notification + alerte désactivée (one-shot, réarmable). Le sync de prix couvre collection ∪ wishlist ∪ alertes actives.

## Export
| Méthode | Route | Params | Réponse |
|---|---|---|---|
| GET | `/api/export/csv` | — | CSV Moxfield |
| GET | `/api/export/sell.csv` | — | CSV de mise en vente (prix trend EUR, conditions Cardmarket) |
| GET | `/api/export/tradelist.csv` | `playset?=4` | CSV liste d'échange (surplus au-delà du playset, hors terrains de base) |
| GET | `/api/export/pdf` | — | PDF de valorisation (inventaire daté, pour assurance) |

## Administration (admin)
| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| GET | `/api/admin/status` | — | `{ health, data, backup, jobs, settings }` |
| POST | `/api/admin/actions/sync-bulk` | — | `202 { started }` / `409 { running }` (fire-and-forget) |
| POST | `/api/admin/actions/sync-fr` | — | `202 { started }` / `409 { running }` (noms FR, bulk `all_cards`, fire-and-forget) |
| POST | `/api/admin/actions/price-job` | — | `202 { started }` / `409 { running }` (fire-and-forget) |
| POST | `/api/admin/actions/commander-cache` | — | `202 { started }` / `409 { running }` (cache EDHREC / Spellbook, entrées périmées seulement) |
| POST | `/api/admin/actions/flush-cache` | — | `{ cleared }` (clés de cache supprimées) |
| GET | `/api/admin/settings` | — | `{ price_job_hours, default_threshold, default_days }` |
| PUT | `/api/admin/settings` | `{ price_job_hours?, default_threshold?, default_days? }` | settings (périodicité du job prix appliquée à chaud) |
| POST | `/api/admin/users/:id/revoke-sessions` | — | `{ revoked }` (déconnexion forcée : supprime les refresh tokens) |
