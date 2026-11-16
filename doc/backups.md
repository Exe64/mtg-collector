# Backups

Critical data (accounts, collections, snapshots, wishlists, decks) lives in
the `pgdata` volume. `cards` and `sets` can be rebuilt from Scryfall, the rest
cannot: back it up.

## Taking a backup

A compressed `pg_dump` from the running stack is enough:

```bash
mkdir -p backups
docker compose exec -T postgres pg_dump -U "$DB_USER" magic_collection | gzip > "backups/magic_collection_$(date +%Y%m%d_%H%M%S).sql.gz"
```

Schedule it with cron or a systemd timer, rotate old dumps, and copy them off
the machine (rclone, restic, borg…). Encrypt them if they leave your network:
they contain account e-mails and password hashes.

## Backup status in Administration

The backend mounts `MTG_BACKUP_DIR` (default `./backups`) read-only and shows
the most recent file named `magic_collection_*` in **Administration**. Keep
that prefix if you want the status to show up.

## Restore

```bash
gunzip -c backups/<dump>.sql.gz | docker compose exec -T postgres psql -U "$DB_USER" magic_collection
```

Test a restore from time to time into a throwaway PostgreSQL container, never
straight into production.
