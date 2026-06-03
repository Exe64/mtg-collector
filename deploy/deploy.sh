#!/usr/bin/env bash
#
# deploy.sh — Déploiement automatique de Magic Collection Manager depuis un repo
# GitHub privé vers /opt/mtg-collector. Idempotent : clone au premier run, puis
# `git fetch` + `git reset --hard` (workflow SPECS §11.4).
#
# Usage (en root) :
#   sudo MTG_REPO_URL=git@github.com:OWNER/REPO.git ./deploy.sh
#
# ⚠️  Exécute ce script depuis un emplacement HORS de $MTG_APP_DIR (ex. /root),
#     sinon le `git reset --hard` réécrit le script en cours d'exécution.
#
# Variables :
#   MTG_REPO_URL    (requis si premier clone)   URL SSH du repo privé
#   MTG_BRANCH      (défaut main)               branche à déployer
#   MTG_APP_DIR     (défaut /opt/mtg-collector) répertoire cible
#   MTG_DEPLOY_KEY  (défaut /root/.ssh/mtg_deploy) clé SSH de déploiement
#   MTG_HEALTH_URL  (défaut http://localhost/api/health)
#
set -euo pipefail

REPO_URL="${MTG_REPO_URL:-git@github.com:OWNER/mtg-collector.git}"
BRANCH="${MTG_BRANCH:-main}"
APP_DIR="${MTG_APP_DIR:-/opt/mtg-collector}"
DEPLOY_KEY="${MTG_DEPLOY_KEY:-/root/.ssh/mtg_deploy}"
HEALTH_URL="${MTG_HEALTH_URL:-http://localhost/api/health}"

export GIT_SSH_COMMAND="ssh -i ${DEPLOY_KEY} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

log() { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[deploy] %s\033[0m\n' "$*" >&2; }

[[ $EUID -eq 0 ]] || { err "À exécuter en root (sudo)."; exit 1; }
command -v docker >/dev/null || { err "Docker absent — lance d'abord provision-vm.sh."; exit 1; }

# ---------------------------------------------------------------------------
# 1. Récupération du code (clone initial OU mise à jour propre)
# ---------------------------------------------------------------------------
if [[ -d "$APP_DIR/.git" ]]; then
  log "Mise à jour du dépôt (${BRANCH})…"
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/${BRANCH}"
  git -C "$APP_DIR" clean -fd
else
  log "Clonage initial dans ${APP_DIR}…"
  mkdir -p "$APP_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

# ---------------------------------------------------------------------------
# 2. Fichier d'environnement — généré automatiquement au premier déploiement
# ---------------------------------------------------------------------------
if [[ ! -f .env ]]; then
  log "Premier déploiement : génération de .env avec secrets aléatoires…"
  (
    umask 077
    cat > .env <<EOF
DB_USER=magic_user
DB_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
NODE_ENV=production
PORT=3001
# Passe à true une fois servi derrière HTTPS (cookie refresh Secure)
COOKIE_SECURE=false
SCRYFALL_USER_AGENT=MagicCollectionManager/1.0 (admin@example.com)
EOF
  )
  log ".env généré (chmod 600). Pense à renseigner un vrai contact User-Agent."
else
  log ".env existant conservé."
fi

# ---------------------------------------------------------------------------
# 3. Build + démarrage (les migrations s'appliquent au boot du backend)
# ---------------------------------------------------------------------------
log "Pull des images de base + build + démarrage…"
docker compose pull --ignore-buildable 2>/dev/null || true
docker compose up -d --build --remove-orphans

# Nettoyage des images orphelines pour économiser le disque
docker image prune -f >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
# 4. Vérification de santé
# ---------------------------------------------------------------------------
log "Attente de la disponibilité (${HEALTH_URL})…"
for _ in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    log "✅ Application en ligne : $(curl -fsS "$HEALTH_URL")"
    echo
    log "Rappel : charge les cartes une première fois avec :"
    log "  docker compose exec backend npm run sync:bulk"
    exit 0
  fi
  sleep 5
done

err "L'application n'a pas répondu après 150 s."
docker compose ps
docker compose logs --tail=50 backend
exit 1
