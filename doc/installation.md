# Installation

MTG Collector runs as four containers (PostgreSQL, Redis, backend, nginx
frontend) with Docker Compose. Any Linux host with Docker Engine and the
Compose plugin works; 2 GB of RAM and 5 GB of disk are comfortable.

## 1. Get the code

```bash
git clone https://github.com/Exe64/mtg-collector.git
cd mtg-collector
cp .env.example .env
```

## 2. Configure `.env`

| Variable | Required | Notes |
|---|---|---|
| `DB_USER`, `DB_PASSWORD` | yes | PostgreSQL credentials, pick a strong password |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | yes | Two different values, generate each with `openssl rand -hex 64`. The backend refuses to boot with weak or missing secrets |
| `SCRYFALL_USER_AGENT` | yes | Scryfall asks for a real contact, e.g. `MTGCollector/1.0 (you@your-domain)` |
| `COOKIE_SECURE` | yes | `true` behind HTTPS, `false` for plain HTTP on a LAN |
| `TRUST_PROXY` | yes | Number of proxies in front of the backend: `1` for this compose file alone (nginx), `2` if you add your own reverse proxy |
| `HEALTHCHECK_PRICE_URL` | no | Dead-man's-switch for the price job, see [operations](operations.md) |
| `LOG_LEVEL` | no | `info` by default |

## 3. Start

```bash
docker compose up -d --build
```

Migrations run automatically on backend start. The app answers on port 80:

- Frontend: `http://<host>/`
- Health check: `http://<host>/api/health`

## 4. Create the admin account

Open the app and register: **the first account created becomes the
administrator**, and public registration closes right after. Further accounts
are created from **Administration → Accounts**.

## 5. Load the card database

The card catalogue comes from Scryfall bulk data and must be loaded once:

```bash
docker compose exec backend npm run sync:bulk
docker compose exec backend npm run sync:fr
```

`sync:bulk` loads about 90k cards and every set; `sync:fr` (to run after it)
downloads the ~2 GB `all_cards` file to fill French names. Both are then
refreshed automatically every week, see [operations](operations.md).

## HTTPS

The compose file only exposes HTTP on port 80. For an Internet-facing
instance, put it behind your own reverse proxy (Traefik, Caddy, nginx…) that
terminates TLS, then set `COOKIE_SECURE=true` and `TRUST_PROXY=2`.

## Next steps

- [Operations](operations.md): scheduled jobs and manual commands
- [Backups](backups.md): backup, restore and status in Administration
