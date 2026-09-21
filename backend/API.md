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

## Vérif deck
| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| POST | `/api/decks/check` | `{ url }` (Moxfield) **ou** `{ text }` (liste Moxfield/MTGO) | `{ cards[], summary }` (cartes manquantes vs collection, comparaison par nom ; chaque carte porte ses versions possédées) |

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
| POST | `/api/admin/actions/flush-cache` | — | `{ cleared }` (clés de cache supprimées) |
| GET | `/api/admin/settings` | — | `{ price_job_hours, default_threshold, default_days }` |
| PUT | `/api/admin/settings` | `{ price_job_hours?, default_threshold?, default_days? }` | settings (périodicité du job prix appliquée à chaud) |
| POST | `/api/admin/users/:id/revoke-sessions` | — | `{ revoked }` (déconnexion forcée : supprime les refresh tokens) |
