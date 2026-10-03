#!/usr/bin/env bash
# data-stores-up.sh -- start (or restart) the Paystream DATA TIER as containers.
#
#   PostgreSQL : the record of truth. Data lives in a named volume so it
#                survives container restarts and app redeploys.
#   Redis      : the cache. No volume -- a cache is disposable by design.
#
# Both publish to 127.0.0.1 ONLY, so just the backend on this host can reach
# them (never the public internet). The native backend connects to them at
# localhost:5432 / localhost:6379 exactly as before -- no code change.
set -euo pipefail

DB_PASSWORD="${DB_PASSWORD:-change-me-in-prod}"

start_or_run() {
  local name="$1"; shift
  if [ "$(docker ps -aq -f "name=^${name}$")" ]; then
    docker start "$name" >/dev/null
  else
    docker run -d --name "$name" --restart unless-stopped "$@" >/dev/null
  fi
}

# PostgreSQL 16 (persistent)
start_or_run paystream-postgres \
  -p 127.0.0.1:5432:5432 \
  -e POSTGRES_USER=paystream \
  -e POSTGRES_PASSWORD="${DB_PASSWORD}" \
  -e POSTGRES_DB=paystream \
  -v paystream-pgdata:/var/lib/postgresql/data \
  postgres:16

# Redis 7 (cache, ephemeral)
start_or_run paystream-redis \
  -p 127.0.0.1:6379:6379 \
  redis:7

echo "data stores up:"
docker ps --filter "name=paystream-" --format '  {{.Names}}   {{.Image}}   {{.Status}}'
