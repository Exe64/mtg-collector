# Operations

## Scheduled jobs

The backend schedules its own jobs (no host cron needed):

| When (UTC) | Job | What it does |
|---|---|---|
| Every 12 h (00:00, 12:00), configurable in Administration | Price job | Refreshes prices from Scryfall (Cardmarket EUR), takes collection and set snapshots, evaluates price alerts, purges expired tokens |
| Sunday 04:00 | Weekly sync | `sync:bulk` then French names |
| Daily 05:30 | EDHREC cache | Warms the commander data cache |
| Daily 06:15 | Update check | Looks for a newer GitHub Release, see [updating](updating.md) |

Between two syncs, new cards enter the database lazily when someone adds them.

## Manual commands

```bash
# Run the price job now
docker compose exec backend npm run job:daily

# Reload the card catalogue
docker compose exec backend npm run sync:bulk
docker compose exec backend npm run sync:fr

# Backend tests
docker compose exec backend npm test
```

The same actions (bulk sync, price update, cache flush) are available as
buttons in **Administration**, which also shows database and Redis status,
the last syncs and the last backup.

## Monitoring

If `HEALTHCHECK_PRICE_URL` points to a [healthchecks.io](https://healthchecks.io)
check (or any compatible endpoint), the price job pings start, success and
failure, so you get an alert when it **stops running**. No-op when empty.

## Logs

```bash
docker compose logs -f backend
```

Logs are JSON (pino); set `LOG_LEVEL=debug` in `.env` for more detail.
