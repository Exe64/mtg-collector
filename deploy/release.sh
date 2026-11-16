#!/usr/bin/env bash
#
# release.sh — Bump the app version, commit and create the vX.Y.Z tag.
#
# Usage : npm run release -- <patch|minor|major>
# Then  : git push origin main --follow-tags   (the tag triggers .github/workflows/release.yml)
#
set -euo pipefail

BUMP="${1:-}"
case "$BUMP" in patch|minor|major) ;; *) echo "usage: npm run release -- <patch|minor|major>" >&2; exit 1 ;; esac

cd "$(dirname "${BASH_SOURCE[0]}")/.."

[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "release must be cut from main" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "working tree not clean" >&2; exit 1; }
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "local main differs from origin/main (pull/push first)" >&2; exit 1; }

# backend/package.json is the source of truth; frontend follows it.
VERSION="$(cd backend && npm version "$BUMP" --no-git-tag-version)"   # prints vX.Y.Z
if git rev-parse -q --verify "refs/tags/$VERSION" >/dev/null; then
  git checkout -- backend/package.json backend/package-lock.json
  echo "tag $VERSION already exists" >&2; exit 1
fi
(cd frontend && npm version "${VERSION#v}" --no-git-tag-version --allow-same-version >/dev/null)

git add backend/package.json backend/package-lock.json frontend/package.json frontend/package-lock.json
git commit -m "chore(release): $VERSION"
git tag -a "$VERSION" -m "$VERSION"

echo "Created $VERSION. Publish it with: git push origin main --follow-tags"
