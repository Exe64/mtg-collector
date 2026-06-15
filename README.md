# Magic Collection Manager

Application web full-stack multi-utilisateur pour l'inventaire et la valorisation
de collections Magic: The Gathering. Voir [SPECS.md](SPECS.md) pour la spec complète
et [backend/API.md](backend/API.md) pour la référence API.

## Fonctionnalités

- **Auth JWT** multi-utilisateur (access token 30 min + refresh token rotaté en cookie httpOnly, **détection de réutilisation → révocation de la lignée**), collections isolées par compte
- **Ajouter** : recherche autocomplétée, affichage de **toutes les versions/éditions**, ajout/retrait direct via **−/+ normale et foil** (état au choix)
- **Collection** : recherche par nom + filtres (type, rareté, couleur, coût de mana, état, **finition**), groupement par extension, édition inline (qté, finition, état), pagination, export
- **Vérif deck** : liste collée (Moxfield/MTGO), `.txt` ou URL Moxfield → **cartes manquantes** vs collection (comparaison par nom, toutes versions ; affiche les versions possédées)
- **Wishlist** : liste de souhaits avec coût estimé
- **Mouvements de prix** : page dédiée hausses / baisses / variations (sélecteurs période + seuil) ; Top 10 sur le tableau de bord
- **Alertes prix** : seuils par carte + notifications in-app (badge), évaluées au job prix
- **Journal** : historique des ajouts/retraits de la collection, avec annulation
- **Extensions** : catalogue filtrable (dont promos), **complétion par set** (liste + détail avec filtres possédées / toutes / manquantes), valeur possédée par extension
- **Détail carte** : modale image HD, texte oracle, prix, et **rulings officiels** (Wizards/Gatherer via Scryfall)
- **Tableau de bord** : valeur EUR/USD, courbe d'évolution (tooltip au survol), donuts (couleur, rareté, état, type), top 10 (valeur unitaire)
- **Import/Export** : CSV Moxfield + **ManaBox** (résolution exacte par Scryfall ID) + générique, **tag emplacement par lot**, export CSV Moxfield + PDF
- **Onboarding masse** : scanner via une app tierce (ex. ManaBox) → export CSV → import ; chaque lot taggé à un emplacement physique
- **Complétion** : suivi par extension avec % et **numéros manquants** (set de base strict via `printed_size`), emplacement physique des cartes
- **Prix** : Scryfall (Cardmarket EUR), job **toutes les 12h** (00:00 et 12:00 UTC) → snapshots collection/édition + historique par carte
- **PWA** : installable, Service Worker (app shell offline), conditions **Cardmarket** (MT→PO)
- **Administration** (admin) : état système (DB/Redis, dernières synchros, dernière sauvegarde), actions à la demande (sync bulk / MAJ prix / vider le cache), réglages globaux, gestion des comptes + déconnexion forcée

> Durcissement : rate-limiting étagé, CSP stricte (`script-src 'self'`), validation des secrets au boot, anti-injection de formule CSV, détection de réutilisation des refresh tokens. Sauvegardes chiffrées hors-machine + surveillance + drill de restauration (§ Sauvegardes). CI GitHub Actions (lint + tests unitaires/intégration + build).

## Décisions d'architecture (revue de spec)

| # | Décision |
|---|----------|
| 1 | Pas de badge de variation ; **courbes de prix** carte / édition / collection via tables d'historique, job 12h. |
| 2 | Auth par **cookie httpOnly `SameSite=Strict`** + nginx reverse-proxy `/api` (même origine, pas de CORS). |
| 3 | Reset password / vérif email **hors scope v1** (usage perso). |
| 4/7 | **Bulk-data Scryfall = source primaire** + **lazy upsert** à l'ajout + autocomplete live. |
| 5 | `finish` (nonfoil/foil/etched) au lieu d'un booléen. |
| 6 | `cards.card_faces` JSONB pour préserver la donnée DFC. |
| 8 | Migrations **`node-pg-migrate`**, appliquées automatiquement au démarrage. |

## Démarrage

```bash
cp .env.example .env
# Renseigner DB_PASSWORD et générer les secrets :
#   openssl rand -hex 64   # -> JWT_SECRET
#   openssl rand -hex 64   # -> JWT_REFRESH_SECRET
docker compose up --build
```

- Frontend : http://localhost (port 80)
- API (via proxy) : http://localhost/api/health
- Sur la VM : http://ip-vm

### Synchronisation des cartes (bulk-data Scryfall)

```bash
# Charge ~90k cartes + tous les sets en base (source primaire des données cartes)
docker compose exec backend npm run sync:bulk
```

À lancer une fois après le premier démarrage, puis hebdomadairement. Entre deux
syncs, les nouvelles cartes entrent en base via *lazy upsert* à l'ajout.

### Autres opérations

```bash
# Job quotidien à la demande : MAJ prix des cartes possédées + snapshots + cmc
docker compose exec backend npm run job:daily

# Tests unitaires backend
docker compose exec backend npm test
```

> Le filtre « coût de mana » s'appuie sur la colonne `cmc`, remplie au sync.
> Après mise à jour, lance `npm run job:daily` une fois pour peupler `cmc` sur
> les cartes déjà possédées.

## Accès mobile (HTTPS local — install PWA)

L'install PWA sur le téléphone exige un *secure context* : `localhost` suffit
sur le PC, mais le téléphone a besoin de **HTTPS**.

```bash
# 1. Générer un certificat de confiance pour l'IP LAN de la machine Windows
./deploy/local-tls.sh 192.168.1.50      # remplace par ton IP (ipconfig)

# 2. Installer la racine CA mkcert sur le téléphone (chemin affiché par le script)

# 3. Passer COOKIE_SECURE=true dans .env, puis démarrer en TLS
docker compose -f docker-compose.yml -f docker-compose.tls.yml up --build

# 4. (WSL2) Forwarder le 443 depuis Windows — PowerShell admin :
#    netsh interface portproxy add v4tov4 listenport=443 \
#      listenaddress=0.0.0.0 connectport=443 connectaddress=<IP_WSL>
```

→ Téléphone : `https://192.168.1.50`. Détails dans [deploy/local-tls.sh](deploy/local-tls.sh).

## Sauvegardes

La donnée critique (comptes, collection, snapshots, wishlist) vit dans le volume
`pgdata` — `cards`/`sets` se reconstruisent depuis Scryfall, le reste non.
[deploy/backup-db.sh](deploy/backup-db.sh) fait un `pg_dump` compressé + rotation
locale, chiffrement AES256 optionnel (gpg), et **copie hors-machine** via rclone.

```bash
# Manuel
./deploy/backup-db.sh

# Cron quotidien (2h) — voir l'en-tête du script
0 2 * * * /opt/mtg-collector/deploy/backup-db.sh >> /var/log/mtg-backup.log 2>&1
```

Variables (`.env` de l'app ou env du cron) : `MTG_BACKUP_DIR`, `MTG_BACKUP_KEEP`
(14), `MTG_BACKUP_PASSPHRASE_FILE` (chiffrement), `MTG_RCLONE_REMOTE` (copie
hors-machine, ex. `gdrive:mtg-backups`). Restauration : voir l'en-tête du script.

**rclone → Google Drive** : installer rclone, puis `rclone authorize "drive"`
(sur un poste avec navigateur) et coller le token via `rclone config` sur le VPS ;
enfin renseigner `MTG_RCLONE_REMOTE=gdrive:mtg-backups` dans `.env`.

**Surveillance (dead-man's-switch)** : si `MTG_HEALTHCHECK_URL` (backup) ou
`HEALTHCHECK_PRICE_URL` (job prix) pointent vers un check [healthchecks.io](https://healthchecks.io),
chaque exécution pingue start/succès/échec → **alerte si le job cesse de tourner**
(le pire scénario silencieux). No-op si non configuré.

**Vérifier qu'une sauvegarde se restaure** (à faire de temps en temps) :
[deploy/verify-backup.sh](deploy/verify-backup.sh) restaure le dernier dump dans
un PostgreSQL **jetable** et compte les lignes — sans toucher à la prod :
```bash
./deploy/verify-backup.sh        # ou : ./deploy/verify-backup.sh <dump>
```

## Structure

```
backend/
  migrations/            schéma + évolutions (node-pg-migrate, auto au boot)
  test/                  unitaires (node:test) + test/integration (supertest, gated RUN_DB_TESTS)
  eslint.config.js       config ESLint (flat)
  src/
    app.js               app Express configurée (exportable pour les tests)
    index.js             boot : validation env + listen + planification des jobs
    config/              pool pg, client redis, logger
    middleware/          requireAuth / requireAdmin (JWT), limiters (rate-limit), validate
    routes/              auth, cards, sets, collection, import, export, wishlist,
                         decks, alerts, admin
    services/            scryfall, cards, collection, snapshots, priceSync, dailyJob,
                         importer, bulkData, pricing, cache, tokens, deckCheck,
                         alerts, collectionLog, settings, jobRunner
    scripts/             syncBulk, runDailyJob
  API.md                 référence des endpoints
frontend/
  eslint.config.js       config ESLint (React + hooks)
  src/
    api/                 client fetch (refresh auto, download authentifié)
    stores/              auth, cardModal (zustand)
    pages/               Dashboard, Collection, Add, Sets, SetDetail, Movements,
                         ImportExport, Wishlist, DeckCheck, Alerts, Journal,
                         Accounts, Login, Register
    components/          ui (Layout, CardModal, ScrollToTop, ErrorBoundary), collection, search→Add, charts
  nginx.conf             reverse-proxy /api (prod)
deploy/                  provision-vm.sh, deploy.sh, local-tls.sh, backup-db.sh,
                         verify-backup.sh (Rocky Linux / OVH)
.github/workflows/       ci.yml — lint + tests (unitaires/intégration) + build
```

## État d'avancement

Sprints 1 à 10 du plan SPECS réalisés (socle, cartes, collection, frontend,
browse set, import/export, dashboard, PWA, wishlist, vérif deck, mouvements,
alertes, journal, administration, polish). Durcissement en place : sécurité
(rate-limit, CSP, détection de réutilisation de tokens), sauvegardes chiffrées
hors-machine + **surveillance** + **drill de restauration**
([deploy/backup-db.sh](deploy/backup-db.sh), [deploy/verify-backup.sh](deploy/verify-backup.sh)),
**CI GitHub Actions** (lint + tests unitaires/intégration + build), ESLint.
