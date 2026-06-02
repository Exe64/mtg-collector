# Magic Collection Manager

Application web full-stack multi-utilisateur pour l'inventaire et la valorisation
de collections Magic: The Gathering. Voir [SPECS.md](SPECS.md) pour la spec complète.

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

- Frontend : http://localhost:3000
- API (via proxy) : http://localhost:3000/api/health

### Synchronisation des cartes (bulk-data Scryfall)

```bash
# Charge ~90k cartes + tous les sets en base (source primaire des données cartes)
docker compose exec backend npm run sync:bulk
```

À lancer une fois après le premier démarrage, puis hebdomadairement (le job prix
quotidien du Sprint 3 le réutilisera). Entre deux syncs, les nouvelles cartes
entrent en base via *lazy upsert* à l'ajout en collection.

## Structure

```
backend/   Express + pg + ioredis ; migrations/ (node-pg-migrate)
frontend/  React + Vite + Tailwind (PWA) ; nginx reverse-proxy /api
```
