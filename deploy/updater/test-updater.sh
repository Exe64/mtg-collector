#!/usr/bin/env bash
# shellcheck disable=SC2016  # check() evals its single-quoted conditions on purpose
#
# test-updater.sh — Dry-run tests of mtg-updater.sh: throwaway git remote with version
# tags, fake `docker compose` and fake backup. No Docker, no root, nothing pushed.
#
# Usage : ./deploy/updater/test-updater.sh
#
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="$(mktemp -d /tmp/mtg-updater-test.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
FAILS=0
ok()  { echo "  ✅ $1"; }
ko()  { echo "  ❌ $1"; FAILS=$((FAILS + 1)); }
check() { if eval "$2"; then ok "$1"; else ko "$1"; fi; }

# --- Fake docker compose: logs calls; `up` fails when the checked-out version is in
# FAKE_BROKEN; backend health reports the checked-out version; psql input is captured.
cat > "$WORK/fake-compose" <<'FAKE'
#!/usr/bin/env bash
echo "compose $*" >> "$FAKE_DIR/calls"
ver() { sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' backend/package.json | head -n1; }
case "$1" in
  stop) exit 0 ;;
  up)   [[ " ${FAKE_BROKEN:-} " == *" $(ver) "* ]] && { echo "unhealthy" >&2; exit 1; }
        [ "${FAKE_SLOW_UP:-}" = "$(ver)" ] && sleep 30
        exit 0 ;;
  exec)
    if [ "$3" = backend ]; then printf '{"status":"ok","version":"%s"}\n' "$(ver)"
    elif [[ " $* " == *" -c "* ]]; then :   # psql -c: no stdin, like the real one
    else cat >> "$FAKE_DIR/psql-input"; fi ;;
esac
FAKE
cat > "$WORK/fake-backup" <<'FAKE'
#!/usr/bin/env bash
[ -n "${FAKE_BACKUP_FAIL:-}" ] && { echo "backup boom" >&2; exit 1; }
f="$FAKE_DIR/magic_collection_test.sql.gz"
echo "SELECT 'restored';" | gzip > "$f"
echo "[backup] OK"; echo "BACKUP_FILE=$f"
FAKE
chmod +x "$WORK/fake-compose" "$WORK/fake-backup"

# --- Remote with v1.0.0, v1.1.0, v1.2.0 (+ a non-semver tag that must be ignored)
git init -q --bare "$WORK/remote.git"
git clone -q "$WORK/remote.git" "$WORK/seed" 2>/dev/null
mkdir -p "$WORK/seed/backend" "$WORK/seed/deploy/updater"
cp "$SRC/deploy/updater/mtg-updater.sh" "$WORK/seed/deploy/updater/"
cd "$WORK/seed"
git config user.email t@t; git config user.name t
for v in 1.0.0 1.1.0 1.2.0; do
  printf '{\n  "name": "x",\n  "version": "%s"\n}\n' "$v" > backend/package.json
  if [ "$v" = 1.2.0 ]; then
    # Shift every byte of the agent in the target version: if the running script were
    # rewritten in place, the rest of the run would execute garbage (T5.10).
    { head -n1 "$SRC/deploy/updater/mtg-updater.sh"; for i in $(seq 200); do echo "# padding $i ------------------------------"; done
      tail -n +2 "$SRC/deploy/updater/mtg-updater.sh"; } > deploy/updater/mtg-updater.sh
  fi
  git add -A; git commit -qm "v$v"; git tag "v$v"
done
git tag v9.9.9-rc1; git tag latest
git push -q origin HEAD:main --tags 2>/dev/null

# --- One instance = a clone checked out at a given ref
setup() { # ref
  rm -rf "$WORK/app" "$WORK/fake"; mkdir -p "$WORK/fake"
  git clone -q "$WORK/remote.git" "$WORK/app" 2>/dev/null
  git -C "$WORK/app" checkout -q "$1"
  mkdir -p "$WORK/app/updates/requests"
  echo '{"action":"update"}' > "$WORK/app/updates/requests/request.json"
}
run() {
  FAKE_DIR="$WORK/fake" MTG_APP_DIR="$WORK/app" MTG_COMPOSE="$WORK/fake-compose" \
  MTG_BACKUP_SCRIPT="$WORK/fake-backup" MTG_UPDATE_LOCK="$WORK/lock" \
    timeout 60 bash "$WORK/app/deploy/updater/mtg-updater.sh" < /dev/null > "$WORK/out" 2>&1 || echo "exit=$?" >> "$WORK/out"
}
run_bg() {
  FAKE_DIR="$WORK/fake" MTG_APP_DIR="$WORK/app" MTG_COMPOSE="$WORK/fake-compose" \
  MTG_BACKUP_SCRIPT="$WORK/fake-backup" MTG_UPDATE_LOCK="$WORK/lock" \
    bash "$WORK/app/deploy/updater/mtg-updater.sh" < /dev/null > "$WORK/out" 2>&1 &
  PID=$!
}
st()  { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p" "$WORK/app/updates/status.json"; }
ver() { sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' "$WORK/app/backend/package.json"; }
calls() { cat "$WORK/fake/calls" 2>/dev/null; }

echo "T5.1 mise à jour réussie (v1.0.0 → v1.2.0, plus haut tag stable)"
setup v1.0.0; run
check "state=succeeded" '[ "$(st state)" = succeeded ]'
check "from=1.0.0 to=1.2.0" '[ "$(st from)" = 1.0.0 ] && [ "$(st to)" = 1.2.0 ]'
check "code en 1.2.0" '[ "$(ver)" = 1.2.0 ]'
check "demande consommée" '[ ! -e "$WORK/app/updates/requests/request.json" ]'
check "backend arrêté avant la sauvegarde" 'calls | head -n1 | grep -q "compose stop backend"'
check "up --build --wait" 'calls | grep -q "compose up -d --build --wait"'
check "log écrit" 'grep -q "succeeded/done" "$WORK/app/updates/update.log"'
check "finishedAt présent" 'grep -q finishedAt "$WORK/app/updates/status.json"'

echo "T5.2 échec du démarrage → rollback (code + base restaurés)"
setup v1.0.0; FAKE_BROKEN=1.2.0 run
check "state=rolled_back" '[ "$(st state)" = rolled_back ]'
check "code revenu en 1.0.0" '[ "$(ver)" = 1.0.0 ]'
check "retour sur la branche main" '[ "$(git -C "$WORK/app" symbolic-ref -q --short HEAD)" = main ] || [ "$(git -C "$WORK/app" rev-parse HEAD)" = "$(git -C "$WORK/app" rev-parse v1.0.0)" ]'
check "DROP/CREATE DATABASE" 'calls | grep -q "DROP DATABASE IF EXISTS magic_collection"'
check "dump rejoué" 'grep -q "restored" "$WORK/fake/psql-input"'

echo "T5.3 échec du rollback → failed + intervention manuelle"
setup v1.0.0; FAKE_BROKEN="1.2.0 1.0.0" run
check "state=failed step=rollback" '[ "$(st state)" = failed ] && [ "$(st step)" = rollback ]'
check "message cite la sauvegarde" 'grep -q "intervention manuelle" "$WORK/app/updates/status.json"'

echo "T5.4 échec de la sauvegarde → rien de modifié, backend relancé"
setup v1.0.0; FAKE_BACKUP_FAIL=1 run
check "state=failed step=backup" '[ "$(st state)" = failed ] && [ "$(st step)" = backup ]'
check "code inchangé (1.0.0)" '[ "$(ver)" = 1.0.0 ]'
check "backend relancé" 'calls | tail -n1 | grep -q "compose up -d --wait"'
check "pas de checkout ni de restauration" '! calls | grep -q "DROP DATABASE"'

echo "T5.5 déjà à jour → aucune action"
setup v1.2.0; run
check "state=failed (déjà à jour)" '[ "$(st state)" = failed ] && grep -q "Déjà à jour" "$WORK/app/updates/status.json"'
check "aucun appel compose" '[ -z "$(calls)" ]'

echo "T5.6 modifications locales → refus sans arrêt du backend"
setup v1.0.0; echo '{}' > "$WORK/app/backend/package.json"; run
check "state=failed preflight" '[ "$(st state)" = failed ] && [ "$(st step)" = preflight ]'
check "message modifications locales" 'grep -q "modifications locales" "$WORK/app/updates/status.json"'

echo "T5.7 pas de demande → sortie silencieuse"
setup v1.0.0; rm "$WORK/app/updates/requests/request.json"; run
check "aucun status.json" '[ ! -e "$WORK/app/updates/status.json" ]'

echo "T5.8 symlink planté sur update.log → refus"
setup v1.0.0; ln -s "$WORK/victim" "$WORK/app/updates/update.log"; run
check "victime non écrite" '[ ! -e "$WORK/victim" ]'
check "aucune action" '[ -z "$(calls)" ]'

echo "T5.9 contenu de la demande ignoré (cible imposée par l'agent)"
setup v1.0.0; echo '{"action":"update","target":"v1.1.0; touch '"$WORK"'/pwned"}' > "$WORK/app/updates/requests/request.json"; run
check "cible = plus haut tag (1.2.0)" '[ "$(ver)" = 1.2.0 ]'
check "aucune injection" '[ ! -e "$WORK/pwned" ]'

echo "T5.10 le checkout réécrit le script (v1.2.0 décalé de 200 lignes) sans casser le run"
setup v1.0.0; run
check "script de la cible bien différent" '! cmp -s "$SRC/deploy/updater/mtg-updater.sh" "$WORK/app/deploy/updater/mtg-updater.sh"'
check "run terminé normalement" '[ "$(st state)" = succeeded ] && ! grep -q "exit=" "$WORK/out"'

echo "T5.11 git en erreur pendant le contrôle d'arbre propre → refus (pas de faux « propre »)"
setup v1.0.0; echo garbage > "$WORK/app/.git/index"; run
check "state=failed preflight" '[ "$(st state)" = failed ] && [ "$(st step)" = preflight ]'
check "aucun appel compose" '[ -z "$(calls)" ]'

echo "T5.12 demande plantée sous forme de dossier → supprimée (pas de boucle .path)"
setup v1.0.0; rm "$WORK/app/updates/requests/request.json"; mkdir "$WORK/app/updates/requests/request.json"; run
check "dossier supprimé" '[ ! -e "$WORK/app/updates/requests/request.json" ]'

echo "T5.13 SIGTERM pendant la construction → rollback"
setup v1.0.0; FAKE_SLOW_UP=1.2.0 run_bg; sleep 2; kill -TERM "$PID"; wait "$PID" 2>/dev/null || true
check "state=rolled_back" '[ "$(st state)" = rolled_back ]'
check "message interrompu" 'grep -q "interrompu" "$WORK/app/updates/status.json"'
check "code revenu en 1.0.0" '[ "$(ver)" = 1.0.0 ]'

echo "T5.14 agent lancé en root sur un dépôt d'un autre utilisateur, sans SUDO_UID (cas systemd réel)"
if [ "$(id -u)" != 0 ] && sudo -n true 2>/dev/null; then
  setup v1.0.0
  # shellcheck disable=SC2024  # redirect as the calling user on purpose
  sudo -n env -u SUDO_UID -u SUDO_USER FAKE_DIR="$WORK/fake" MTG_APP_DIR="$WORK/app" MTG_COMPOSE="$WORK/fake-compose" \
    MTG_BACKUP_SCRIPT="$WORK/fake-backup" MTG_UPDATE_LOCK="$WORK/lock-root" \
    bash "$WORK/app/deploy/updater/mtg-updater.sh" < /dev/null > "$WORK/out" 2>&1 || true
  check "state=succeeded (pas de « dubious ownership »)" '[ "$(st state)" = succeeded ]'
  check "aucun fichier root dans le dépôt" '[ -z "$(find "$WORK/app" -path "$WORK/app/updates" -prune -o -user root -print)" ]'
  sudo -n rm -rf "$WORK/app/updates" "$WORK/lock-root" "$WORK/fake"
else
  echo "  ⏭️  ignoré (nécessite sudo -n, hors root)"
fi

echo
if [ "$FAILS" -eq 0 ]; then echo "ALL PASS"; else echo "$FAILS FAILED"; exit 1; fi
