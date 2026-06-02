#!/usr/bin/env bash
# Smoke-test de l'auth (Sprint 1). Lancer la stack d'abord : docker compose up --build
# Usage : ./backend/smoke-test.sh [base_url]   (défaut http://localhost:3000)
set -euo pipefail

BASE="${1:-http://localhost:3000}"
JAR="$(mktemp)"
EMAIL="test+$(date +%s)@example.com"
PASS="Password1"

echo "→ health"
curl -fsS "$BASE/api/health"; echo

echo "→ register ($EMAIL)"
REG=$(curl -fsS -c "$JAR" -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"display_name\":\"Tester\"}")
echo "$REG"
ACCESS=$(echo "$REG" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

echo "→ me (route protégée)"
curl -fsS "$BASE/api/auth/me" -H "Authorization: Bearer $ACCESS"; echo

echo "→ refresh (cookie httpOnly)"
curl -fsS -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/refresh"; echo

echo "→ cards/search?q=lightning bolt (live Scryfall + cache)"
curl -fsS "$BASE/api/cards/search?q=lightning%20bolt" \
  -H "Authorization: Bearer $ACCESS" | head -c 400; echo

echo "→ sets?type=expansion (cache + persistance)"
curl -fsS "$BASE/api/sets?type=expansion" \
  -H "Authorization: Bearer $ACCESS" | head -c 200; echo

echo "→ login"
curl -fsS -c "$JAR" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"; echo

echo "→ logout"
curl -fsS -b "$JAR" -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/auth/logout"

echo "→ refresh après logout (doit échouer en 401)"
curl -s -b "$JAR" -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/auth/refresh"

rm -f "$JAR"
echo "✓ smoke-test terminé"
