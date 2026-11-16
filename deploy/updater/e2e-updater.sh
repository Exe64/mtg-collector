#!/usr/bin/env bash
# shellcheck disable=SC2016,SC2034  # check() evals single-quoted conditions (which use OID_BEFORE)
#
# e2e-updater.sh — End-to-end test of the update agent on a SEPARATE throwaway
# instance: compose project "mtge2e" on 127.0.0.1:8033, local git remote with test
# tags (v0.8.0 → v0.9.0 with a migration, v0.9.1 with a broken migration), encrypted
# backups, agent installed for real with install.sh (systemd). Nothing is pushed.
#
# Needs Docker, systemd and `sudo -n`. Installs /etc/systemd/system/mtg-updater.*
# for the duration of the test: do not run it on a host where the agent is installed.
#
# Usage : ./deploy/updater/e2e-updater.sh            # run (keeps the instance for inspection)
#         ./deploy/updater/e2e-updater.sh cleanup    # uninstall the agent, remove the instance
#
set -euo pipefail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
E="${MTG_E2E_DIR:-/tmp/mtg-updater-e2e}"
URL=http://localhost:8033
log() { echo "[e2e $(date +%T)] $*"; }
FAILS=0
check() { if eval "$2"; then echo "  ✅ $1"; else echo "  ❌ $1"; FAILS=$((FAILS + 1)); fi; }

cleanup() {
  log "cleanup"
  sudo -n systemctl disable --now mtg-updater.path >/dev/null 2>&1 || true
  sudo -n rm -f /etc/systemd/system/mtg-updater.path /etc/systemd/system/mtg-updater.service
  sudo -n systemctl daemon-reload || true
  sudo -n systemctl reset-failed mtg-updater.path mtg-updater.service >/dev/null 2>&1 || true
  if [ -d "$E/app" ]; then (cd "$E/app" && docker compose down -v --remove-orphans >/dev/null 2>&1) || true; fi
}
[ "${1:-}" = cleanup ] && { cleanup; sudo -n rm -rf "$E"; exit 0; }

cleanup; sudo -n rm -rf "$E"; mkdir -p "$E"

log "seed remote with v0.8.0, v0.9.0 (new migration), v0.9.1 (broken migration)"
git init -q --bare --initial-branch=main "$E/remote.git"
git clone -q "$SRC" "$E/seed"
# include the uncommitted work of the dev tree
(cd "$SRC" && git ls-files -m -o --exclude-standard) | rsync -a --files-from=- "$SRC/" "$E/seed/"
cd "$E/seed"; git config user.email e2e@test; git config user.name e2e
git add -A; git commit -qm "e2e: working tree" || true
bump() { (cd backend && npm version "$1" --no-git-tag-version --allow-same-version >/dev/null); (cd frontend && npm version "$1" --no-git-tag-version --allow-same-version >/dev/null); }
bump 0.8.0; git commit -qam "e2e v0.8.0"; git tag v0.8.0
bump 0.9.0
cat > backend/migrations/1799000000000_e2e-v090.js <<'EOF'
export const up = (pgm) => { pgm.sql('CREATE TABLE e2e_v090 (note TEXT)'); };
export const down = (pgm) => { pgm.sql('DROP TABLE e2e_v090'); };
EOF
git add -A; git commit -qm "e2e v0.9.0"; git tag v0.9.0
bump 0.9.1
cat > backend/migrations/1799100000000_e2e-broken.js <<'EOF'
export const up = (pgm) => { pgm.sql('THIS IS NOT SQL'); };
export const down = () => {};
EOF
git add -A; git commit -qm "e2e v0.9.1 (broken)"; git tag v0.9.1
git push -q "$E/remote.git" HEAD:main v0.8.0 v0.9.0   # v0.9.1 pushed before test B

log "instance at v0.8.0"
git clone -q "$E/remote.git" "$E/app"; cd "$E/app"; git checkout -q v0.8.0
umask 077; openssl rand -hex 32 > "$E/pass"; umask 022
cat > .env <<EOF
COMPOSE_PROJECT_NAME=mtge2e
DB_USER=e2e_user
DB_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
SCRYFALL_USER_AGENT=MTGCollectorE2E/1.0
COOKIE_SECURE=false
TRUST_PROXY=1
MTG_BACKUP_DIR=$E/backups
MTG_BACKUP_PASSPHRASE_FILE=$E/pass
MTG_UPDATES_DIR=$E/app/updates
EOF
cat > docker-compose.override.yml <<'EOF'
services:
  frontend:
    ports: !override
      - '127.0.0.1:8033:80'
EOF
docker compose up -d --build --wait --wait-timeout 600 >/dev/null 2>&1
check "instance démarrée en 0.8.0" '[ "$(curl -s $URL/api/health | sed -n "s/.*\"version\":\"\([^\"]*\)\".*/\1/p")" = 0.8.0 ]'

TOKEN=$(curl -s -X POST $URL/api/auth/register -H 'content-type: application/json' \
  -d '{"email":"admin@e2e.test","password":"Password1","display_name":"Admin"}' | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
api() { curl -s -X "$1" "$URL/api$2" -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' ${3:+-d "$3"}; }
login() { TOKEN=$(curl -s -X POST $URL/api/auth/login -H 'content-type: application/json' -d '{"email":"admin@e2e.test","password":"Password1"}' | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p'); }
api POST /auth/users '{"email":"marker@e2e.test","password":"Password1","display_name":"Marker"}' >/dev/null
users() { docker compose exec -T postgres psql -U e2e_user -d magic_collection -tAc "SELECT count(*) FROM users WHERE email='marker@e2e.test'"; }
dboid() { docker compose exec -T postgres psql -U e2e_user -d postgres -tAc "SELECT oid FROM pg_database WHERE datname='magic_collection'"; }
has_table() { docker compose exec -T postgres psql -U e2e_user -d magic_collection -tAc "SELECT to_regclass('public.$1') IS NOT NULL"; }
check "marqueur créé" '[ "$(users)" = 1 ]'

log "install agent (systemd)"
sudo -n env MTG_APP_DIR="$E/app" "$E/app/deploy/updater/install.sh" >/dev/null
check "agent actif" 'systemctl is-active --quiet mtg-updater.path'
check "requests/ appartient à 1000" '[ "$(stat -c %u "$E/app/updates/requests")" = 1000 ] && [ "$(stat -c %U "$E/app/updates")" = root ]'

wait_done() { # wait for a terminal status newer than $1
  for _ in $(seq 120); do
    st=$(sed -n 's/.*"state":"\([^"]*\)".*/\1/p' "$E/app/updates/status.json" 2>/dev/null || true)
    fin=$(sed -n 's/.*"finishedAt":"\([^"]*\)".*/\1/p' "$E/app/updates/status.json" 2>/dev/null || true)
    if [ -n "$st" ] && [ "$st" != running ] && [[ "$fin" > "$1" ]]; then return 0; fi
    sleep 5
  done
  return 1
}
state() { sed -n 's/.*"state":"\([^"]*\)".*/\1/p' "$E/app/updates/status.json"; }
ver() { curl -s $URL/api/health | sed -n 's/.*"version":"\([^"]*\)".*/\1/p'; }

log "A — mise à jour depuis l'admin (route réelle) : 0.8.0 → highest tag"
login; api POST /admin/updates/check >/dev/null
R=$(api POST /admin/updates/apply); echo "  apply: $R"
check "apply 202" 'echo "$R" | grep -q "\"requested\":true"'
T0=$(echo "$R" | sed -n 's/.*"requestedAt":"\([^"]*\)".*/\1/p')
wait_done "$T0" || true
check "A state=succeeded" '[ "$(state)" = succeeded ]'
check "A backend en 0.9.0" '[ "$(ver)" = 0.9.0 ]'
check "A migration 0.9.0 appliquée" '[ "$(has_table e2e_v090)" = t ]'
check "A marqueur conservé" '[ "$(users)" = 1 ]'
check "A sauvegarde chiffrée créée" 'ls "$E"/backups/magic_collection_*.sql.gz.gpg >/dev/null 2>&1'
check "A pas de fichier root dans le dépôt" '[ -z "$(find "$E/app" -path "$E/app/updates" -prune -o -user root -print | head -1)" ]'
check "A progress expose le statut" 'api GET /admin/updates/progress | grep -q "\"state\":\"succeeded\""'

log "B — v0.9.1 (migration cassée) → rollback"
git -C "$E/seed" push -q "$E/remote.git" v0.9.1
OID_BEFORE=$(dboid)
login; api POST /admin/updates/check >/dev/null
R=$(api POST /admin/updates/apply); echo "  apply: $R"
T1=$(echo "$R" | sed -n 's/.*"requestedAt":"\([^"]*\)".*/\1/p')
wait_done "$T1" || true
check "B state=rolled_back" '[ "$(state)" = rolled_back ]'
check "B backend revenu en 0.9.0" '[ "$(ver)" = 0.9.0 ]'
check "B code revenu sur v0.9.0" '[ "$(git -C "$E/app" describe --tags)" = v0.9.0 ]'
check "B base recréée (oid changé)" '[ "$(dboid)" != "$OID_BEFORE" ]'
check "B données restaurées (marqueur + table 0.9.0)" '[ "$(users)" = 1 ] && [ "$(has_table e2e_v090)" = t ]'
check "B message explicite" 'grep -q "données restaurées" "$E/app/updates/status.json"'

log "C — demande en double pendant un run → 409 (verrou)"
login; R=$(api POST /admin/updates/apply); R2=$(api POST /admin/updates/apply)
echo "  apply #1: $R"; echo "  apply #2: $R2"
check "C second apply refusé" 'echo "$R2" | grep -q "déjà"'
T2=$(echo "$R" | sed -n 's/.*"requestedAt":"\([^"]*\)".*/\1/p'); [ -n "$T2" ] && { wait_done "$T2" || true; }

echo; if [ "$FAILS" -eq 0 ]; then echo "E2E ALL PASS"; else echo "E2E $FAILS FAILED"; exit 1; fi
