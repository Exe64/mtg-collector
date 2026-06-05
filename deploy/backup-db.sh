#!/usr/bin/env bash
#
# backup-db.sh — Sauvegarde compressée de la base PostgreSQL, avec rotation.
#
# Usage :
#   ./backup-db.sh
#   (à mettre en cron, ex. tous les jours à 2h :)
#   0 2 * * * /opt/mtg-collector/deploy/backup-db.sh >> /var/log/mtg-backup.log 2>&1
#
# Variables :
#   MTG_APP_DIR     (défaut /opt/mtg-collector)
#   MTG_BACKUP_DIR  (défaut /opt/mtg-collector-backups)
#   MTG_BACKUP_KEEP (défaut 14)  nombre de sauvegardes conservées
#
set -euo pipefail

APP_DIR="${MTG_APP_DIR:-/opt/mtg-collector}"
BACKUP_DIR="${MTG_BACKUP_DIR:-/opt/mtg-collector-backups}"
KEEP="${MTG_BACKUP_KEEP:-14}"

# Charge DB_USER depuis le .env de l'app
set -a
[ -f "$APP_DIR/.env" ] && . "$APP_DIR/.env"
set +a
DB_USER="${DB_USER:-magic_user}"

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

ts="$(date +%Y%m%d-%H%M%S)"
file="$BACKUP_DIR/magic_collection_${ts}.sql.gz"

echo "[backup] pg_dump → $file"
docker compose exec -T postgres pg_dump -U "$DB_USER" magic_collection | gzip > "$file"

# Vérifie que le dump n'est pas vide
if [ ! -s "$file" ]; then
  echo "[backup] ÉCHEC : dump vide" >&2
  rm -f "$file"
  exit 1
fi

# Rotation : ne garder que les KEEP plus récents
ls -1t "$BACKUP_DIR"/magic_collection_*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f

echo "[backup] OK ($(du -h "$file" | cut -f1)). Restauration :"
echo "  gunzip -c $file | docker compose exec -T postgres psql -U $DB_USER magic_collection"
