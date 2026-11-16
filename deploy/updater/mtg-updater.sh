#!/usr/bin/env bash
#
# mtg-updater.sh — Host agent: applies an update requested from the admin UI.
#
# Started by mtg-updater.path when <MTG_UPDATES_DIR>/requests/request.json appears
# (see install.sh). Runs as root on the host; the backend container never gets the
# Docker socket, it can only drop that request file.
#
# Flow: stop backend → backup (deploy/backup-db.sh) → checkout of the highest vX.Y.Z tag
#       → docker compose up --build --wait → version check.
#       Any failure after the checkout → previous commit + DB restore from the backup
#       → state "rolled_back".
#
# The request content is NEVER read: the target is resolved here from git tags, so no
# value coming from the backend reaches this root shell.
#
# Variables (env or .env): MTG_APP_DIR, MTG_UPDATES_DIR (default <app>/updates),
#   MTG_UPDATE_REMOTE (default origin), MTG_UPDATE_TIMEOUT (seconds, default 600),
#   MTG_COMPOSE (default "docker compose"), MTG_BACKUP_SCRIPT, + backup-db.sh variables.
#
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MTG_APP_DIR="${MTG_APP_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# Note: the checkout below rewrites this very file while it runs. That is safe because
# git replaces files (new inode) and bash keeps reading the one it opened (test T5.10).
APP_DIR="$MTG_APP_DIR"
ENV_FILE="$APP_DIR/.env"
env_get() {
  [ -f "$ENV_FILE" ] || return 0
  local v
  v="$(grep -E "^${1}=" "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
  v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}
conf() { local v="${!1:-$(env_get "$1")}"; printf '%s' "${v:-$2}"; }

UPDATES_DIR="$(conf MTG_UPDATES_DIR "$APP_DIR/updates")"
case "$UPDATES_DIR" in /*) ;; *) UPDATES_DIR="$APP_DIR/${UPDATES_DIR#./}" ;; esac
REMOTE="$(conf MTG_UPDATE_REMOTE origin)"
TIMEOUT="$(conf MTG_UPDATE_TIMEOUT 600)"
read -r -a COMPOSE <<< "$(conf MTG_COMPOSE 'docker compose')"
BACKUP_SCRIPT="$(conf MTG_BACKUP_SCRIPT "$APP_DIR/deploy/backup-db.sh")"
DB_USER="$(conf DB_USER magic_user)"
PASS_FILE="$(conf MTG_BACKUP_PASSPHRASE_FILE '')"
PASS="$(conf MTG_BACKUP_PASSPHRASE '')"
LOCK="$(conf MTG_UPDATE_LOCK /run/lock/mtg-updater.lock)"

REQUEST="$UPDATES_DIR/requests/request.json"
STATUS="$UPDATES_DIR/status.json"
LOG="$UPDATES_DIR/update.log"

exec 9>"$LOCK"
flock -n 9 || { echo "[updater] another run is in progress" >&2; exit 0; }

[ -e "$REQUEST" ] || [ -L "$REQUEST" ] || exit 0

# Our files live in the root-owned folder (the backend can only write in requests/);
# still refuse to write through symlinks.
for f in "$STATUS" "$STATUS.tmp" "$LOG"; do
  [ ! -L "$f" ] || { echo "[updater] refusing symlink $f" >&2; rm -rf -- "$REQUEST"; exit 1; }
done
: > "$LOG"; chmod 644 "$LOG"
exec > >(tee -a "$LOG") 2>&1

STARTED="$(date -u +%FT%TZ)"
FROM=""; TO=""; STEP="preflight"; PREV_REF=""; BACKUP_FILE=""; STOPPED=0; CHECKED_OUT=0; REASON=""

json() { local s="${1//\\/\\\\}"; s="${s//\"/\\\"}"; s="${s//$'\n'/ }"; s="${s//$'\t'/ }"; printf '"%s"' "$s"; }
set_status() { # state step message
  local now finished=""
  now="$(date -u +%FT%TZ)"
  [ "$1" = running ] || finished=",\"finishedAt\":$(json "$now")"
  printf '{"state":%s,"step":%s,"from":%s,"to":%s,"message":%s,"startedAt":%s,"updatedAt":%s%s}\n' \
    "$(json "$1")" "$(json "$2")" "$(json "$FROM")" "$(json "$TO")" "$(json "$3")" \
    "$(json "$STARTED")" "$(json "$now")" "$finished" > "$STATUS.tmp"
  chmod 644 "$STATUS.tmp"
  mv -f "$STATUS.tmp" "$STATUS"
  echo "[updater] $(date -u +%T) $1/$2: $3"
}
step() { STEP="$1"; set_status running "$1" "$2"; }
fail() { REASON="$1"; return 1; }

# Run git as the owner of the checkout: as root, git refuses a repo owned by someone
# else ("dubious ownership") and would leave root-owned files in .git and the tree.
REPO_OWNER="$(stat -c %U "$APP_DIR/.git")"
g() {
  if [ "$(id -u)" = 0 ] && [ "$REPO_OWNER" != root ]; then runuser -u "$REPO_OWNER" -- git "$@"
  else git "$@"; fi
}

app_version() { sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' backend/package.json | head -n1; }
newer() { [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n1)" = "$1" ]; }

compose_up() { "${COMPOSE[@]}" up -d --build --wait --wait-timeout "$TIMEOUT"; }
health_version() {
  "${COMPOSE[@]}" exec -T backend wget -qO- http://localhost:3001/api/health \
    | sed -n 's/.*"version":"\([^"]*\)".*/\1/p'
}
decrypt() {
  if [[ "$1" == *.gpg ]]; then
    if [ -n "$PASS_FILE" ]; then gpg --batch --passphrase-file "$PASS_FILE" -d "$1"
    else gpg --batch --passphrase "$PASS" -d "$1"; fi
  else cat "$1"; fi
}
restore_db() {
  "${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -q \
    -c 'DROP DATABASE IF EXISTS magic_collection WITH (FORCE)' \
    -c "CREATE DATABASE magic_collection OWNER \"$DB_USER\""
  decrypt "$1" | gunzip | "${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d magic_collection -v ON_ERROR_STOP=1 -q >/dev/null
}

rollback() {
  trap - ERR
  set +e
  local why="$1"
  STEP="rollback"
  set_status running rollback "Échec ($why) — retour à la version $FROM"
  "${COMPOSE[@]}" stop backend
  if g checkout -q --force "$PREV_REF" && restore_db "$BACKUP_FILE" && compose_up; then
    set_status rolled_back rollback "Échec ($why) : version $FROM et données restaurées"
  else
    set_status failed rollback "Échec ($why) puis échec du rollback — intervention manuelle requise (sauvegarde : $BACKUP_FILE)"
  fi
  exit 0
}

MAIN_PID=$BASHPID
on_err() {
  local rc=$?
  # errtrace propagates this trap into $(...) subshells: there, just fail so the
  # parent's command fails and the trap runs once, in the main shell.
  [ "$BASHPID" = "$MAIN_PID" ] || exit "$rc"
  trap - ERR
  local why="${REASON:-étape « $STEP » en échec (code $rc)}"
  if [ "$CHECKED_OUT" = 1 ]; then rollback "$why"; fi
  # Nothing changed yet: just bring the backend back if we stopped it.
  set +e
  [ "$STOPPED" = 0 ] || "${COMPOSE[@]}" up -d --wait --wait-timeout "$TIMEOUT" backend
  set_status failed "$STEP" "$why — aucune modification appliquée"
  exit 0
}
trap on_err ERR
# systemd stop / TimeoutStartSec: roll back as for any failure (TimeoutStopSec leaves time).
trap 'REASON="interrompu (signal)"; on_err' TERM INT

cd "$APP_DIR"
FROM="$(app_version)"
step preflight "Préparation"
# Consume the request only once "running" is published, so the backend never sees a
# window with neither a pending request nor a running update. -r: even a planted
# directory must go, or the .path unit would re-trigger forever (rm never follows links).
rm -rf -- "$REQUEST"
dirty="$(g status --porcelain --untracked-files=no)"   # assignment: a git error trips ERR
[ -z "$dirty" ] || fail "modifications locales dans $APP_DIR"
g fetch --quiet --tags --force "$REMOTE"
TARGET="$(g tag -l 'v*' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -n1 || true)"
[ -n "$TARGET" ] || fail "aucun tag de version trouvé sur $REMOTE"
TO="${TARGET#v}"
if ! newer "$TO" "$FROM"; then
  set_status skipped preflight "Déjà à jour ($FROM ≥ $TO) — rien à faire"
  exit 0
fi
PREV_REF="$(g symbolic-ref -q --short HEAD || g rev-parse HEAD)"

step stop "Arrêt du backend"
STOPPED=1
"${COMPOSE[@]}" stop backend

step backup "Sauvegarde de la base"
out="$("$BACKUP_SCRIPT")"
echo "$out"
BACKUP_FILE="$(sed -n 's/^BACKUP_FILE=//p' <<< "$out" | tail -n1)"
{ [ -n "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; } || fail "sauvegarde introuvable"

step checkout "Passage à $TARGET"
# git checkout is all-or-nothing (e.g. refused when an untracked file would be
# overwritten): only a successful checkout calls for a rollback.
g checkout -q --detach "$TARGET"
CHECKED_OUT=1

step build "Construction et démarrage de $TARGET"
compose_up

step verify "Vérification de la version"
[ "$(health_version)" = "$TO" ] || fail "le backend ne répond pas en version $TO"

trap - ERR
set_status succeeded "done" "Mise à jour $FROM → $TO réussie (sauvegarde : $BACKUP_FILE)"
