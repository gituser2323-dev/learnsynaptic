#!/usr/bin/env bash
# Start local STAGING stack (non-production).
# Requires: mongod available; .env.staging.local present.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.staging.local ]]; then
  echo "Missing .env.staging.local — aborting."
  exit 1
fi

mkdir -p .data/mongodb-staging .storage-uploads-staging

if ! nc -z -G 1 127.0.0.1 27017 2>/dev/null; then
  echo "Starting local staging MongoDB on 127.0.0.1:27017 ..."
  nohup mongod \
    --dbpath "$ROOT/.data/mongodb-staging" \
    --port 27017 \
    --bind_ip 127.0.0.1 \
    --logpath "$ROOT/.data/mongodb-staging/mongod.log" \
    >/dev/null 2>&1 &
  sleep 2
fi

if ! nc -z -G 2 127.0.0.1 27017 2>/dev/null; then
  echo "MongoDB failed to start. Check .data/mongodb-staging/mongod.log"
  exit 1
fi

echo "MongoDB staging: up"
echo "Running preflight..."
npx tsx --env-file=.env.staging.local scripts/preflightCheck.ts

echo "Starting Next.js with .env.staging.local (port 3000)..."
# Next loads .env.local by default; force staging by exporting vars then starting.
set -a
# shellcheck disable=SC1091
source <(grep -v '^#' .env.staging.local | grep -v '^$' | sed 's/^/export /')
set +a
exec npx next dev --port 3000
