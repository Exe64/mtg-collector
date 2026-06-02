#!/usr/bin/env bash
#
# provision-vm.sh — Prépare une VM Rocky Linux 10 *from scratch* pour héberger
# Magic Collection Manager (Docker Engine + Compose, pare-feu, clé de déploiement).
#
# Usage (en root) :
#   sudo ./provision-vm.sh
#
# Variables optionnelles :
#   MTG_APP_DIR    (défaut /opt/mtg-collector)   répertoire applicatif
#   MTG_DEPLOY_KEY (défaut /root/.ssh/mtg_deploy) clé SSH de déploiement
#   MTG_HTTP_PORT  (défaut 3000)                 port HTTP exposé (frontend)
#
set -euo pipefail

APP_DIR="${MTG_APP_DIR:-/opt/mtg-collector}"
DEPLOY_KEY="${MTG_DEPLOY_KEY:-/root/.ssh/mtg_deploy}"
HTTP_PORT="${MTG_HTTP_PORT:-3000}"

log()  { printf '\033[1;34m[provision]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[provision] %s\033[0m\n' "$*" >&2; }

[[ $EUID -eq 0 ]] || { err "À exécuter en root (sudo)."; exit 1; }

# ---------------------------------------------------------------------------
log "Mise à jour du système…"
dnf -y update

log "Installation des outils de base…"
dnf -y install git curl ca-certificates dnf-plugins-core firewalld \
               policycoreutils-python-utils openssl

# ---------------------------------------------------------------------------
log "Configuration du dépôt Docker CE…"
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

log "Installation de Docker Engine + plugins (compose, buildx)…"
dnf -y install docker-ce docker-ce-cli containerd.io \
               docker-buildx-plugin docker-compose-plugin

log "Activation de Docker au démarrage…"
systemctl enable --now docker

# Autorise l'utilisateur sudo courant à piloter Docker sans root (si applicable)
if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
  log "Ajout de ${SUDO_USER} au groupe docker…"
  usermod -aG docker "${SUDO_USER}"
fi

# ---------------------------------------------------------------------------
log "Pare-feu : ouverture de SSH + ${HTTP_PORT}/tcp…"
systemctl enable --now firewalld
firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-port="${HTTP_PORT}/tcp"
firewall-cmd --reload

# ---------------------------------------------------------------------------
log "Création du répertoire applicatif ${APP_DIR}…"
mkdir -p "$APP_DIR"

# Clé de déploiement SSH (lecture seule) pour le repo GitHub privé
install -d -m 700 "$(dirname "$DEPLOY_KEY")"
if [[ ! -f "$DEPLOY_KEY" ]]; then
  log "Génération de la clé de déploiement SSH (ed25519)…"
  ssh-keygen -t ed25519 -N "" -C "mtg-collector-deploy" -f "$DEPLOY_KEY"
else
  log "Clé de déploiement déjà présente : $DEPLOY_KEY"
fi

# Empreinte GitHub dans known_hosts
ssh-keyscan -t ed25519 github.com >> /root/.ssh/known_hosts 2>/dev/null || true
sort -u /root/.ssh/known_hosts -o /root/.ssh/known_hosts 2>/dev/null || true

# ---------------------------------------------------------------------------
log "Docker : $(docker --version)"
log "Compose : $(docker compose version | head -n1)"

cat <<EOF

============================================================
 ✅ Provisioning terminé.

 1) Ajoute cette clé publique comme *Deploy key* (lecture seule)
    du repo GitHub privé :
       GitHub → repo → Settings → Deploy keys → Add deploy key

 ----- clé publique -----
$(cat "${DEPLOY_KEY}.pub")
 ------------------------

 2) Lance ensuite le déploiement :
       sudo MTG_REPO_URL=git@github.com:OWNER/REPO.git ./deploy.sh

 (Si tu viens d'être ajouté au groupe docker, reconnecte-toi.)
============================================================
EOF
