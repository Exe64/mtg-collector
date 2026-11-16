#!/usr/bin/env bash
#
# install.sh — Installs the update agent (systemd .path + .service) on the host.
#
# Usage (root) : sudo ./deploy/updater/install.sh
#   Uninstall  : sudo systemctl disable --now mtg-updater.path && sudo rm /etc/systemd/system/mtg-updater.*
#
# Creates <MTG_UPDATES_DIR> (root-owned) with requests/ writable by the backend (uid 1000).
#
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${MTG_APP_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
ENV_FILE="$APP_DIR/.env"
v=""
if [ -f "$ENV_FILE" ]; then v="$(grep -E '^MTG_UPDATES_DIR=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"; fi
v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"   # same quote handling as env_get
UPDATES_DIR="${MTG_UPDATES_DIR:-${v:-$APP_DIR/updates}}"
case "$UPDATES_DIR" in /*) ;; *) UPDATES_DIR="$APP_DIR/${UPDATES_DIR#./}" ;; esac
BACKEND_UID="${MTG_BACKEND_UID:-1000}"   # user "node" of the backend image

install -d -m 755 -o root -g root "$UPDATES_DIR"
install -d -m 750 -o "$BACKEND_UID" -g root "$UPDATES_DIR/requests"
chown root:root "$UPDATES_DIR"   # in case docker or a previous install created it

for unit in mtg-updater.path mtg-updater.service; do
  sed -e "s#@APP_DIR@#$APP_DIR#g" -e "s#@UPDATES_DIR@#$UPDATES_DIR#g" \
    "$SCRIPT_DIR/$unit" > "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemctl enable --now mtg-updater.path

echo "Update agent installed: watching $UPDATES_DIR/requests/request.json"
echo "Restart the stack once so the backend sees the folder: docker compose up -d"
