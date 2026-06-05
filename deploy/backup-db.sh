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
#   MTG_APP_DIR              (défaut /opt/mtg-collector)
#   MTG_BACKUP_DIR           (défaut /opt/mtg-collector-backups)
#   MTG_BACKUP_KEEP          (défaut 14)  nombre de sauvegardes conservées
#   MTG_BACKUP_PASSPHRASE_FILE  fichier (chmod 600) contenant la passphrase de chiffrement
#   MTG_BACKUP_PASSPHRASE       passphrase en clair (fallback ; préférer le fichier)
#   -> si l'une est fournie, la sauvegarde est chiffrée AES256 (gpg) en .sql.gz.gpg
#
set -euo pipefail

APP_DIR="${MTG_APP_DIR:-/opt/mtg-collector}"
BACKUP_DIR="${MTG_BACKUP_DIR:-/opt/mtg-collector-backups}"
KEEP="${MTG_BACKUP_KEEP:-14}"
PASS_FILE="${MTG_BACKUP_PASSPHRASE_FILE:-}"
PASS="${MTG_BACKUP_PASSPHRASE:-}"

# Charge DB_USER depuis le .env de l'app
set -a
[ -f "$APP_DIR/.env" ] && . "$APP_DIR/.env"
set +a
DB_USER="${DB_USER:-magic_user}"

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

ts="$(date +%Y%m%d-%H%M%S)"

# Détermine si on chiffre (passphrase via fichier ou env)
ENCRYPT=0
if [ -n "$PASS_FILE" ] || [ -n "$PASS" ]; then
  command -v gpg >/dev/null || { echo "[backup] ÉCHEC : gpg requis pour le chiffrement" >&2; exit 1; }
  ENCRYPT=1
fi

if [ "$ENCRYPT" -eq 1 ]; then
  file="$BACKUP_DIR/magic_collection_${ts}.sql.gz.gpg"
  echo "[backup] pg_dump → gzip → gpg(AES256) → $file"
  if [ -n "$PASS_FILE" ]; then
    GPG_PASS=(--passphrase-file "$PASS_FILE")
  else
    GPG_PASS=(--passphrase "$PASS")
  fi
  docker compose exec -T postgres pg_dump -U "$DB_USER" magic_collection \
    | gzip \
    | gpg --batch --yes --symmetric --cipher-algo AES256 "${GPG_PASS[@]}" -o "$file"
else
  file="$BACKUP_DIR/magic_collection_${ts}.sql.gz"
  echo "[backup] pg_dump → gzip → $file  (⚠️ NON chiffré — renseigne MTG_BACKUP_PASSPHRASE_FILE)"
  docker compose exec -T postgres pg_dump -U "$DB_USER" magic_collection | gzip > "$file"
fi

# Vérifie que le dump n'est pas vide
if [ ! -s "$file" ]; then
  echo "[backup] ÉCHEC : sauvegarde vide" >&2
  rm -f "$file"
  exit 1
fi

# Rotation : ne garder que les KEEP plus récents (chiffrés ou non)
ls -1t "$BACKUP_DIR"/magic_collection_*.sql.gz* 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f

echo "[backup] OK ($(du -h "$file" | cut -f1)). Restauration :"
if [ "$ENCRYPT" -eq 1 ]; then
  echo "  gpg --batch --passphrase-file <fichier> -d $file | gunzip | docker compose exec -T postgres psql -U $DB_USER magic_collection"
else
  echo "  gunzip -c $file | docker compose exec -T postgres psql -U $DB_USER magic_collection"
fi
