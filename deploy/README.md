# Déploiement — Rocky Linux 10

Deux scripts, deux rôles distincts :

| Script | Rôle | Fréquence |
|---|---|---|
| `provision-vm.sh` | Prépare la VM *from scratch* (Docker, pare-feu, clé SSH de déploiement) | une fois par VM |
| `deploy.sh` | Récupère le code du repo privé + build + démarre + healthcheck | à chaque mise à jour |

## Procédure complète (première mise en service)

```bash
# 1. Copier les deux scripts sur la VM (HORS du futur /opt/mtg-collector)
scp deploy/provision-vm.sh deploy/deploy.sh root@vm:/root/

# 2. Sur la VM : provisionner
ssh root@vm
cd /root
./provision-vm.sh
#   -> installe Docker, ouvre le port 80, génère une clé SSH
#   -> AFFICHE une clé publique : à ajouter en "Deploy key" (lecture seule)
#      du repo GitHub privé (Settings -> Deploy keys)

# 3. Déployer
MTG_REPO_URL=git@github.com:OWNER/REPO.git ./deploy.sh
#   -> clone /opt/mtg-collector, génère .env (secrets aléatoires),
#      build, démarre, vérifie /api/health
#   -> l'app est alors joignable sur http://ip-vm

# 4. Charger les cartes Scryfall (une fois)
docker compose -f /opt/mtg-collector/docker-compose.yml exec backend npm run sync:bulk
```

## Mises à jour suivantes

```bash
sudo /root/deploy.sh        # git reset --hard origin/main + rebuild + restart
```

## Production HTTPS (domaine + Let's Encrypt)

Une fois un nom de domaine pointé sur l'IP du serveur :

```bash
# Dans /opt/mtg-collector/.env : renseigner
#   DOMAIN=mtg.mondomaine.fr
#   ACME_EMAIL=moi@exemple.fr
#   COOKIE_SECURE=true
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Caddy ([deploy/Caddyfile](Caddyfile)) obtient et renouvelle le certificat automatiquement,
et devient l'unique entrée publique (80/443). Le frontend n'est plus exposé directement.
Nécessite Docker Compose ≥ 2.24 (directive `!reset`).

## Sauvegardes base de données

```bash
./deploy/backup-db.sh            # dump compressé + rotation (14 par défaut)
# en cron (2h du matin) :
0 2 * * * /opt/mtg-collector/deploy/backup-db.sh >> /var/log/mtg-backup.log 2>&1
```

Restauration : `gunzip -c <fichier>.sql.gz | docker compose exec -T postgres psql -U magic_user magic_collection`.

## Points d'attention

- **Exécuter `deploy.sh` depuis `/root`** (pas depuis `/opt/mtg-collector`) : le
  `git reset --hard` réécrirait le script en cours d'exécution.
- **`.env` est généré au premier déploiement** avec des secrets aléatoires et
  **conservé** ensuite. `COOKIE_SECURE=false` par défaut → passe-le à `true`
  dès que tu sers l'app derrière HTTPS (reverse-proxy TLS).
- **Changement de schéma** : géré par `node-pg-migrate` au démarrage du backend,
  sans `down -v`. Seul un reset destructif des volumes impose `docker compose down -v`.
- **Pare-feu** : seul le port `80` est ouvert (HTTP). Le backend (`3001`) n'est pas
  publié — nginx l'atteint via le réseau Docker interne. L'app répond sur `http://ip-vm`.
