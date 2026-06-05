# Magic Collection Manager

Application web full-stack multi-utilisateur pour l'inventaire et la valorisation
de collections Magic: The Gathering. Voir [SPECS.md](SPECS.md) pour la spec complète
et [backend/API.md](backend/API.md) pour la référence API.

## Fonctionnalités

- **Auth JWT** multi-utilisateur (access token 15 min + refresh token rotaté en cookie httpOnly), collections isolées par compte
- **Ajouter** : recherche autocomplétée, affichage de **toutes les versions/éditions**, ajout direct par ligne (qté/finition/état), **scan caméra OCR** (Tesseract.js, best-effort)
- **Collection** : recherche par nom + filtres (type, rareté, couleur, coût de mana, état), groupement par extension, édition inline (qté, finition, état), pagination, export
- **Extensions** : catalogue filtrable (dont promos), **complétion par set** (liste + détail avec filtres possédées / toutes / manquantes)
- **Détail carte** : modale image HD, texte oracle, prix, et **rulings officiels** (Wizards/Gatherer via Scryfall)
- **Tableau de bord** : valeur EUR/USD, courbe d'évolution, donuts (couleur, rareté, état, type), top 10
- **Import/Export** : CSV Moxfield + **ManaBox** (résolution exacte par Scryfall ID) + générique, **tag emplacement par lot**, export CSV Moxfield + PDF
- **Onboarding masse** : scanner via une app tierce (ex. ManaBox) → export CSV → import ; chaque lot taggé à un emplacement physique
- **Complétion** : suivi par extension avec % et **numéros manquants** (set de base strict via `printed_size`), emplacement physique des cartes
- **Prix** : Scryfall (Cardmarket EUR), job quotidien (3h UTC) → snapshots collection/édition + historique par carte
- **PWA** : installable, Service Worker (app shell offline), conditions **Cardmarket** (MT→PO)

## Décisions d'architecture (revue de spec)

| # | Décision |
|---|----------|
| 1 | Pas de badge de variation ; **courbes de prix** carte / édition / collection via tables d'historique, job 24-48h. |
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

## Accès mobile (HTTPS local — pour le scan caméra)

Le scan caméra (`getUserMedia`) et l'install PWA exigent un *secure context* :
`localhost` suffit sur le PC, mais le téléphone a besoin de **HTTPS**.

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

## Structure

```
backend/
  migrations/            schéma + évolutions (node-pg-migrate, auto au boot)
  test/                  tests node:test
  src/
    config/              pool pg, client redis
    middleware/          requireAuth (JWT)
    routes/              auth, cards, sets, collection, import, export
    services/            scryfall, cards, collection, snapshots, priceSync,
                         dailyJob, importer, bulkData, pricing, cache, tokens
    scripts/             syncBulk, runDailyJob
  API.md                 référence des endpoints
frontend/
  src/
    api/                 client fetch (refresh auto, download authentifié)
    stores/              auth, cardModal (zustand)
    pages/               Dashboard, Collection, Add, Sets, SetDetail, ImportExport, Login, Register
    components/          ui (Layout, CardModal), collection, search→Add, scan, charts
  nginx.conf             reverse-proxy /api (prod)
deploy/                  provision-vm.sh, deploy.sh, local-tls.sh (Rocky Linux / OVH)
```

## État d'avancement

Sprints 1 à 10 du plan SPECS réalisés (socle, cartes, collection, frontend,
browse set, import/export, dashboard, PWA, scan OCR, polish). Reste surtout du
durcissement (couverture de tests, observabilité).
