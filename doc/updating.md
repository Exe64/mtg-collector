# Updating

New versions are published as GitHub Releases (`vX.Y.Z`). Every instance checks
for them, and an admin can apply one from **Administration → Version** in one
click. A small host agent does the work: backup, switch to the new tag, rebuild,
health check, and automatic rollback if anything fails.

Without the agent, the app still tells you a new version exists; you update by
hand (see [Manual update](#manual-update)).

## How an instance learns about a release

- Every day at 06:15 UTC, and when an admin clicks **Vérifier**, the backend asks
  GitHub for the latest stable release of the repository (`releases/latest`;
  drafts and pre-releases are ignored).
- The result is cached in Redis for 26 hours; admin page loads read the cache
  (and query GitHub only when it is empty). A failed check is cached for 10
  minutes, so a GitHub outage does not cost one call per page load. The daily
  job and **Vérifier** always query GitHub; **Vérifier** is limited to 10 clicks
  per hour.
- If the release is newer than the running version, admins see a gold dot on
  **Outils** (desktop, unless unread alerts are shown there), on **Plus**
  (mobile) and on **Administration**, and the release notes in the Version card.

| Variable (`.env`) | Default | Role |
|---|---|---|
| `UPDATES_REPO` | `Exe64/mtg-collector` | Repository to watch. Set it on a fork |
| `UPDATES_GITHUB_TOKEN` | none | Optional. Raises GitHub's limit from 60 to 5000 requests/hour, or gives access to a private repository. A fine-grained token with read-only *Contents* is enough |

The running version comes from `backend/package.json` (shown in Administration
and in `GET /api/health`).

## Installing the update agent

Requirements on the host:

- the instance is a **git clone** of the repository, with a remote that needs
  no credentials (the public HTTPS URL). The agent runs `git fetch`, and its log
  is shown to admins: never put a token in the remote URL;
- systemd, util-linux (`flock`, `runuser`), Docker Engine with a recent
  Compose v2 (`docker compose up --wait --wait-timeout`), and `gpg` if backups
  are encrypted;
- backups configured as described in [backups](backups.md). The agent runs
  `deploy/backup-db.sh` as root from systemd, which only sees **`.env`**: put
  `DB_USER`, `MTG_BACKUP_DIR` and `MTG_BACKUP_PASSPHRASE_FILE` there, not only in
  a crontab. Create the backup folder beforehand with the owner and mode you
  want (otherwise root creates it, mode 755), and prefer encrypted dumps;
- if you start the stack with extra compose files, declare them in `.env`
  (`COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml`) so the agent
  uses the same set.

Install (as root, from the app folder):

```bash
sudo ./deploy/updater/install.sh
```

The script creates the shared folder (`<app>/updates` by default, or
`MTG_UPDATES_DIR` from `.env`) owned by root, with `requests/` writable by the
backend user (uid 1000, `MTG_BACKEND_UID`), installs `mtg-updater.path` and
`mtg-updater.service` in `/etc/systemd/system` and enables the watcher. The
running backend sees the folder right away; recreate it
(`docker compose up -d backend`) only if you changed `MTG_UPDATES_DIR`.

Check it:

```bash
systemctl status mtg-updater.path       # active (waiting)
```

Uninstall:

```bash
sudo systemctl disable --now mtg-updater.path
sudo rm /etc/systemd/system/mtg-updater.path /etc/systemd/system/mtg-updater.service
sudo systemctl daemon-reload
```

### Agent settings

Read from the environment or `.env`:

| Variable | Default | Role |
|---|---|---|
| `MTG_APP_DIR` | folder two levels above the script | App checkout |
| `MTG_UPDATES_DIR` | `<app>/updates` | Shared folder (must match the backend mount; use an absolute path) |
| `MTG_UPDATE_REMOTE` | `origin` | Git remote holding the version tags |
| `MTG_UPDATE_TIMEOUT` | `600` | Seconds `docker compose up --wait` waits for healthy containers |
| `MTG_UPDATE_LOCK` | `/run/lock/mtg-updater.lock` | Lock preventing two runs at once |
| `MTG_COMPOSE` | `docker compose` | Compose command used by the agent (`backup-db.sh` always runs `docker compose`) |
| `MTG_BACKUP_SCRIPT` | `deploy/backup-db.sh` | Backup script; must print `BACKUP_FILE=<path>` |
| `DB_USER`, `MTG_BACKUP_PASSPHRASE_FILE` | as in [backups](backups.md) | Also read by the agent to restore the dump on rollback |

## What an update does

When an admin confirms **Mettre à jour**, the backend drops
`updates/requests/request.json`. systemd starts the agent, which:

1. **Preflight**: refuses if tracked files have local modifications (untracked
   files are allowed), fetches the tags and picks the **highest `vX.Y.Z` tag of
   the git remote**. That is normally the GitHub Release shown in the card; on a
   fork, point both `UPDATES_REPO` and the remote at the fork. If that tag is not
   newer than the running version, the run ends as *skipped* ("Déjà à jour").
2. **Stops the backend**, so no data is written after the backup. The app is
   unavailable from here, usually 1 to 3 minutes.
3. **Backs up** the database with `deploy/backup-db.sh`.
4. **Checks out** the new tag (detached HEAD). If git refuses (for instance an
   untracked file would be overwritten), nothing has changed: the backend is
   started again and the run is *failed*.
5. **Rebuilds and starts** the stack (`docker compose up -d --build --wait`).
   Database migrations run when the backend starts.
6. **Verifies** that the backend answers with the new version.

The admin page follows each step and shows the result and the log of the run.

### Automatic rollback

If anything fails once the new tag is checked out (build error, failed
migration, unhealthy container, wrong version, or the service being stopped),
the agent:

1. checks out the previous commit or branch again;
2. recreates the database and restores the dump taken in step 3;
3. rebuilds and starts the previous version.

The result is **rolled back** (`↺` in the admin page): previous version, data
as they were just before the update. If the rollback itself fails, the result
is **failed** with "intervention manuelle requise" and the path of the backup:
restore it by hand (see [backups](backups.md#restore)).

A failure before that (dirty tree, backup error, refused checkout) changes
nothing; the backend is started again if it was stopped.

### After an update: detached HEAD

A successful update leaves the checkout on the tag, not on a branch (`git status`
says *HEAD detached at vX.Y.Z*). That is the expected state of an instance. To
follow a branch again (a dev checkout, say):

```bash
git switch main && git pull
docker compose up -d --build
```

An instance running on `main` ahead of the latest tag shows the version of the
last release: the next update moves it to the next tag.

## Security model

- The backend never gets the Docker socket. All it can do is create a file in
  `updates/requests/`, the only part of the shared folder it can write to.
- The agent never reads that file: it resolves the target version itself from
  the git tags, so no value from the backend reaches the root shell.
- The status (`updates/status.json`) and log (`updates/update.log`) are written
  by root in a root-owned folder; the agent refuses to write through symlinks.
- Git commands run as the owner of the checkout, so the repository never gets
  root-owned files.

## Manual update

```bash
cd /opt/mtg-collector
docker compose stop backend      # no writes after the backup
./deploy/backup-db.sh
git fetch --tags
git checkout vX.Y.Z              # detached HEAD, see above
docker compose up -d --build
```

To go back: `git checkout <previous tag>`, restore the dump
([backups](backups.md#restore)), `docker compose up -d --build`.

## Troubleshooting

| Symptom | Check |
|---|---|
| "Agent de mise à jour non installé" | No `updates/requests/` folder: run `install.sh` |
| "Dossier /updates/requests non inscriptible" | `requests/` must belong to uid 1000: run `install.sh` again |
| Stuck on "en attente de l'agent" | `systemctl status mtg-updater.path`; `journalctl -u mtg-updater.service`. If the watcher shows `unit-start-limit-hit` (the service failed repeatedly), fix the cause then `systemctl reset-failed mtg-updater.path mtg-updater.service && systemctl start mtg-updater.path`. A request the agent never picked up blocks new ones (409): remove `updates/requests/request.json`, it would fire as soon as the watcher restarts |
| "Déjà à jour" although a release is shown | The git remote has no newer tag: `git fetch --tags` and check `MTG_UPDATE_REMOTE` |
| Failed at preflight with "modifications locales" | `git status` in the app folder; commit, stash or discard local changes |
| Details of the last run | `updates/update.log`, `updates/status.json`, or the log in the admin page |

## Publishing a release (maintainers)

```bash
npm run release -- patch     # or minor / major; from an up-to-date, clean main
git push origin main --follow-tags
```

`npm run release` bumps the version in `backend/` and `frontend/`, commits
`chore(release): vX.Y.Z` and creates the tag. Pushing the tag runs
[`release.yml`](../.github/workflows/release.yml), which checks that the tag
matches the package versions and publishes the GitHub Release with generated
notes. Instances see it at their next check.

To test the agent without Docker or root: `./deploy/updater/test-updater.sh`.
End-to-end on a throwaway instance (Docker, systemd, `sudo`; not on a host where
the agent is installed): `./deploy/updater/e2e-updater.sh`, then
`./deploy/updater/e2e-updater.sh cleanup`.
