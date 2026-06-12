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
#   MTG_RCLONE_REMOTE        cible rclone pour copie hors-machine (ex. gdrive:mtg-backups)
#                            -> si défini + rclone installé, chaque dump est copié hors du VPS
#
set -euo pipefail

# Racine du repo : auto-détectée depuis l'emplacement du script (override : MTG_APP_DIR)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${MTG_APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"

# Charge la config depuis le .env de l'app AVANT de résoudre les variables, pour
# que DB_USER et les MTG_BACKUP_*/MTG_RCLONE_* posés dans .env soient pris en compte.
set -a
[ -f "$APP_DIR/.env" ] && . "$APP_DIR/.env"
set +a

BACKUP_DIR="${MTG_BACKUP_DIR:-${APP_DIR}-backups}"
KEEP="${MTG_BACKUP_KEEP:-14}"
PASS_FILE="${MTG_BACKUP_PASSPHRASE_FILE:-}"
PASS="${MTG_BACKUP_PASSPHRASE:-}"
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

# Copie hors-machine (protection contre la perte du VPS lui-même)
REMOTE="${MTG_RCLONE_REMOTE:-}"
if [ -n "$REMOTE" ]; then
  if command -v rclone >/dev/null 2>&1; then
    echo "[backup] rclone copy → $REMOTE"
    rclone copy "$file" "$REMOTE"
    # Rotation distante : supprime les sauvegardes de plus de KEEP jours
    rclone delete "$REMOTE" --min-age "${KEEP}d" --include "magic_collection_*" 2>/dev/null || true
  else
    echo "[backup] ⚠️ MTG_RCLONE_REMOTE défini mais rclone introuvable — copie hors-machine ignorée" >&2
  fi
else
  echo "[backup] (copie hors-machine désactivée : MTG_RCLONE_REMOTE non défini)"
fi

echo "[backup] OK ($(du -h "$file" | cut -f1)). Restauration :"
if [ "$ENCRYPT" -eq 1 ]; then
  echo "  gpg --batch --passphrase-file <fichier> -d $file | gunzip | docker compose exec -T postgres psql -U $DB_USER magic_collection"
else
  echo "  gunzip -c $file | docker compose exec -T postgres psql -U $DB_USER magic_collection"
fi
