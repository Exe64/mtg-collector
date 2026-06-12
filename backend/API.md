# API REST — Magic Collection Manager

Base : `/api`. Toutes les routes sauf `/api/auth/*` exigent l'en-tête
`Authorization: Bearer <accessToken>`. Le refresh token circule en cookie httpOnly.

## Santé
| Méthode | Route | Réponse |
|---|---|---|
| GET | `/api/health` | `{ status, db, redis }` |

## Authentification
| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password, display_name? }` | `{ user, accessToken }` + cookie |
| POST | `/api/auth/login` | `{ email, password }` | `{ user, accessToken }` + cookie |
| POST | `/api/auth/refresh` | — (cookie) | `{ accessToken }` (rotation) |
| POST | `/api/auth/logout` | — (cookie) | `204` |
| GET | `/api/auth/me` | — | `{ user }` |

Mot de passe : ≥ 8 caractères, 1 majuscule, 1 chiffre. Rate limit : 10 req / 15 min / IP.

## Cartes
| Méthode | Route | Params | Réponse |
|---|---|---|---|
| GET | `/api/cards/search` | `q`, `set?`, `page?`, `unique=cards\|prints` | `{ cards[], total, page, hasMore }` |
| GET | `/api/cards/prints` | `name` | `{ cards[] }` (toutes les éditions) |
| GET | `/api/cards/:scryfallId` | — | `{ card }` (DB-first + lazy upsert) |
| GET | `/api/cards/:scryfallId/rulings` | — | `{ rulings[] }` (source Wizards/Gatherer) |

## Extensions
| Méthode | Route | Params | Réponse |
|---|---|---|---|
| GET | `/api/sets` | `type?` | `{ sets[] }` |
| GET | `/api/sets/:code/cards` | `page?` | `{ cards[], total, page, hasMore }` |

## Collection (isolée par utilisateur)
| Méthode | Route | Params / Corps | Réponse |
|---|---|---|---|
| GET | `/api/collection` | `q, set, color, type, rarity, condition, finish, language, location, cmc, cmcMin, cmcMax, sort, order, page, pageSize` | `{ entries[], total, page, pageSize, stats }` |
| GET | `/api/collection/locations` | — | `{ locations[] }` (emplacements physiques distincts) |
| GET | `/api/collection/stats` | — | `{ totalValue, cardCount, uniqueCardCount, setCount, topCards[], colorBreakdown, rarityBreakdown, conditionBreakdown, typeBreakdown }` |
| GET | `/api/collection/snapshots` | `days?` | `{ snapshots[] }` |
| GET | `/api/collection/set-snapshots` | `set, days?` | `{ snapshots[] }` (courbe de valeur d'une édition) |
| GET | `/api/collection/price-movers` | `days?=7, threshold?=20` | `{ gainers[], losers[], spikes[] }` (top 10 hausses/baisses en € + variations ≥ threshold %) |
| GET | `/api/collection/log` | `days?=30` | `{ log[] }` (journal des ajouts/retraits : delta signé, finition, source, date) |
| POST | `/api/collection/bulk` | `{ ids[], patch:{ finish?, condition?, language?, location? } }` | `{ updated, conflicts }` |
| GET | `/api/collection/owned-by-set` | — | `{ ownedBySet: { code: nb } }` |
| GET | `/api/collection/owned` | `set?` | `{ owned: { scryfall_id: qté } }` |
| POST | `/api/collection` | `{ scryfall_id, quantity, finish, condition, language, acquired_price?, notes? }` | `{ entry }` (incrément sur conflit) |
| POST | `/api/collection/adjust` | `{ scryfall_id, delta, finish?, condition?, language? }` | `{ quantity }` |
| PATCH | `/api/collection/:id` | `{ quantity?, finish?, condition?, language?, notes?, acquired_price?, acquired_at? }` | `{ entry }` / `409` si conflit |
| DELETE | `/api/collection/:id` | — | `204` |

Conditions : `MT, NM, EX, GD, LP, PL, PO`. Finitions : `nonfoil, foil, etched`.
`location` : emplacement physique (fait partie de la clé d'unicité de l'entrée).

## Import / Export
| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| POST | `/api/import/csv` | `multipart: file, mode=merge\|replace, location?, dryRun?` | `{ imported, skipped, errors[] }` ou `{ dryRun, total, resolvedLocally, needsScryfall, invalid, samples }` |

## Wishlist
| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| GET | `/api/wishlist` | — | `{ items[], totalEur }` |
| POST | `/api/wishlist` | `{ scryfall_id, note? }` | `{ id }` |
| DELETE | `/api/wishlist/:id` | — | `204` |
| GET | `/api/export/csv` | — | CSV Moxfield |
| GET | `/api/export/sell.csv` | — | CSV de mise en vente (prix trend EUR, conditions Cardmarket) |
| GET | `/api/export/pdf` | — | PDF de valorisation (inventaire daté, pour assurance) |
