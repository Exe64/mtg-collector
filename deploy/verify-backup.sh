#!/usr/bin/env bash
#
# verify-backup.sh — Drill de restauration : restaure le dernier dump dans un
# PostgreSQL JETABLE (conteneur temporaire) et affiche le nombre de lignes des
# tables critiques. Ne touche PAS à la base de production.
#
# Usage : ./deploy/verify-backup.sh  [chemin/vers/un_dump.sql.gz(.gpg)]
#   (sans argument → prend le dump le plus récent de MTG_BACKUP_DIR)
#
# Réutilise les variables de backup-db.sh (MTG_BACKUP_DIR, MTG_BACKUP_PASSPHRASE_FILE…).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${MTG_APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="$APP_DIR/.env"

env_get() {
  [ -f "$ENV_FILE" ] || return 0
  local v
  v="$(grep -E "^${1}=" "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
  v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}

BACKUP_DIR="${MTG_BACKUP_DIR:-$(env_get MTG_BACKUP_DIR)}"; BACKUP_DIR="${BACKUP_DIR:-${APP_DIR}-backups}"
PASS_FILE="${MTG_BACKUP_PASSPHRASE_FILE:-$(env_get MTG_BACKUP_PASSPHRASE_FILE)}"
PASS="${MTG_BACKUP_PASSPHRASE:-$(env_get MTG_BACKUP_PASSPHRASE)}"
DB_USER="${DB_USER:-$(env_get DB_USER)}"; DB_USER="${DB_USER:-magic_user}"

command -v docker >/dev/null || { echo "[verify] docker requis" >&2; exit 1; }

# Dump à vérifier : argument explicite, sinon le plus récent
file="${1:-$(ls -1t "$BACKUP_DIR"/magic_collection_*.sql.gz* 2>/dev/null | head -n1 || true)}"
[ -n "$file" ] && [ -s "$file" ] || { echo "[verify] aucun dump trouvé dans $BACKUP_DIR" >&2; exit 1; }
echo "[verify] dump : $file"

# Conteneur PostgreSQL jetable
NAME="mtg-verify-$$"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "[verify] démarrage d'un PostgreSQL temporaire…"
docker run --rm -d --name "$NAME" -e POSTGRES_PASSWORD=verify -e POSTGRES_DB=verify postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do
  docker exec "$NAME" pg_isready -U postgres -d verify >/dev/null 2>&1 && break
  sleep 1
done
# rôle attendu par les ALTER ... OWNER du dump (évite des erreurs bruyantes)
docker exec "$NAME" psql -U postgres -d verify -c "CREATE ROLE \"$DB_USER\" NOLOGIN" >/dev/null 2>&1 || true

decrypt() {
  if [[ "$file" == *.gpg ]]; then
    if [ -n "$PASS_FILE" ]; then gpg --batch --passphrase-file "$PASS_FILE" -d "$file"
    else gpg --batch --passphrase "$PASS" -d "$file"; fi
  else cat "$file"; fi
}

echo "[verify] restauration dans la base jetable…"
decrypt | gunzip | docker exec -i "$NAME" psql -U postgres -d verify -v ON_ERROR_STOP=0 >/dev/null

count() { docker exec "$NAME" psql -U postgres -d verify -tAc "SELECT count(*) FROM $1" 2>/dev/null | tr -d '[:space:]'; }
users="$(count users)"; entries="$(count collection_entries)"; cards="$(count cards)"

echo "[verify] ---- Résultat ----"
echo "[verify] users               : ${users:-ERREUR}"
echo "[verify] collection_entries  : ${entries:-ERREUR}"
echo "[verify] cards               : ${cards:-ERREUR}"

if [ "${users:-0}" -ge 1 ] && [ "${entries:-0}" -ge 1 ]; then
  echo "[verify] ✅ Restauration OK (données présentes)."
else
  echo "[verify] ❌ Restauration suspecte (tables vides) — à investiguer." >&2
  exit 1
fi
