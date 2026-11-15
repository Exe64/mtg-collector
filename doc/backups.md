# Backups

Critical data (accounts, collections, snapshots, wishlists, decks) lives in
the `pgdata` volume. `cards` and `sets` can be rebuilt from Scryfall, the rest
cannot: back it up.

## Backup script

[`deploy/backup-db.sh`](../deploy/backup-db.sh) takes a compressed `pg_dump`,
rotates old dumps, optionally encrypts them (AES256 with gpg) and copies them
off the machine with rclone.

```bash
# Manual run
./deploy/backup-db.sh

# Daily at 02:00 (host crontab)
0 2 * * * /opt/mtg-collector/deploy/backup-db.sh >> /var/log/mtg-backup.log 2>&1
```

Variables, read from the app's `.env` or the cron environment:

| Variable | Default | Role |
|---|---|---|
| `MTG_BACKUP_DIR` | `<app dir>-backups` | Where dumps are written. Also mounted read-only in the backend so Administration shows the last backup |
| `MTG_BACKUP_KEEP` | `14` | Number of dumps kept |
| `MTG_BACKUP_PASSPHRASE_FILE` | none | File (chmod 600) holding the encryption passphrase. When set, dumps are `.sql.gz.gpg` |
| `MTG_RCLONE_REMOTE` | none | rclone target for the off-site copy, e.g. `gdrive:mtg-backups` |
| `MTG_HEALTHCHECK_URL` | none | Dead-man's-switch pinged on start, success and failure |

### Off-site copy to Google Drive

Install rclone, run `rclone authorize "drive"` on a machine with a browser,
paste the token into `rclone config` on the server, then set
`MTG_RCLONE_REMOTE=gdrive:mtg-backups`.

## Restore drill

[`deploy/verify-backup.sh`](../deploy/verify-backup.sh) restores the latest
dump into a **throwaway** PostgreSQL container and counts rows, without
touching production. Run it from time to time:

```bash
./deploy/verify-backup.sh            # latest dump
./deploy/verify-backup.sh <dump>     # a specific one
```

## Restore

```bash
# Plain dump
gunzip -c <dump>.sql.gz | docker compose exec -T postgres psql -U <DB_USER> magic_collection

# Encrypted dump
gpg --batch --passphrase-file <file> -d <dump>.sql.gz.gpg | gunzip | docker compose exec -T postgres psql -U <DB_USER> magic_collection
```

The script prints the exact command for each dump it creates.
