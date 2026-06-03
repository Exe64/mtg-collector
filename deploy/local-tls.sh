#!/usr/bin/env bash
#
# local-tls.sh — Génère un certificat TLS *de confiance* (mkcert) pour servir
# l'app en HTTPS en local, afin que la caméra (scan PWA) fonctionne sur mobile.
#
# Usage :
#   ./deploy/local-tls.sh <IP_LAN_WINDOWS> [autres-IP-ou-noms...]
#
# Exemple :
#   ./deploy/local-tls.sh 192.168.1.50
#
# Le certificat doit couvrir l'IP que le TÉLÉPHONE utilise pour joindre l'app,
# c.-à-d. l'IP LAN de la machine Windows (le portproxy redirige ensuite vers WSL2).
#
set -euo pipefail

CERT_DIR="${MTG_CERT_DIR:-$(cd "$(dirname "$0")/.." && pwd)/certs}"

if ! command -v mkcert >/dev/null 2>&1; then
  cat >&2 <<'EOF'
[local-tls] mkcert introuvable. Installe-le d'abord :
  - Ubuntu/WSL : sudo apt install libnss3-tools && \
      curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64" && \
      chmod +x mkcert-v*-linux-amd64 && sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
  - Doc : https://github.com/FiloSottile/mkcert
EOF
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "[local-tls] Usage : $0 <IP_LAN_WINDOWS> [autres...]" >&2
  echo "[local-tls] Trouve ton IP LAN Windows avec : ipconfig (Adresse IPv4)" >&2
  exit 1
fi

echo "[local-tls] Installation de la CA locale mkcert (si nécessaire)…"
mkcert -install

mkdir -p "$CERT_DIR"
HOSTS=(localhost 127.0.0.1 ::1 "$@")

echo "[local-tls] Génération du certificat pour : ${HOSTS[*]}"
mkcert -cert-file "$CERT_DIR/cert.pem" -key-file "$CERT_DIR/key.pem" "${HOSTS[@]}"

cat <<EOF

============================================================
 ✅ Certificat généré :
    $CERT_DIR/cert.pem
    $CERT_DIR/key.pem

 Pour que le TÉLÉPHONE fasse confiance au certificat, installe la
 racine CA mkcert dessus :
    $(mkcert -CAROOT)/rootCA.pem

   - Android : Paramètres → Sécurité → Chiffrement → Installer un certificat → CA
   - iOS     : envoie/ouvre rootCA.pem → Réglages → Profil installé → Activer la confiance
               (Réglages → Général → Informations → Réglages de certificat)

 Puis :
   1) Mets COOKIE_SECURE=true dans .env
   2) docker compose -f docker-compose.yml -f docker-compose.tls.yml up --build
   3) Sur Windows (PowerShell admin), forwarde le 443 vers WSL2 :
        netsh interface portproxy add v4tov4 listenport=443 \\
          listenaddress=0.0.0.0 connectport=443 connectaddress=\$(wsl hostname -I)
      et autorise le port 443 entrant dans le pare-feu Windows.
   4) Sur le téléphone : https://<IP_LAN_WINDOWS>
============================================================
EOF
