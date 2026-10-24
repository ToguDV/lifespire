#!/usr/bin/env bash
# Restore a backup.sh dump (lifespire-*.sql.gz) into a target Postgres.
# Usage: infra/restore.sh <dump.sql.gz>
#
# Env:
#   COMPOSE_FILE   compose project with a `postgres` service
#                  (default: infra/docker-compose.dev.yml)
#   POSTGRES_USER  database user (default: lifespire)
#   TARGET_DB      database to restore into (default: lifespire).
#                  Must exist and be EMPTY — plain-format dumps carry their
#                  own CREATE TABLE statements.
#   RESTORE_OVERWRITE=1  drop and recreate the public schema first, instead
#                  of refusing when the target is not empty.
#   ALLOW_PROD_RESTORE=1 required when COMPOSE_FILE points at prod.
set -euo pipefail

DUMP="${1:-}"
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "usage: infra/restore.sh <dump.sql.gz>" >&2
  exit 2
fi

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.dev.yml}"
POSTGRES_USER="${POSTGRES_USER:-lifespire}"
TARGET_DB="${TARGET_DB:-lifespire}"

if [[ "$COMPOSE_FILE" == *prod* && "${ALLOW_PROD_RESTORE:-}" != "1" ]]; then
  echo "refusing to restore over prod without ALLOW_PROD_RESTORE=1" >&2
  exit 1
fi

psql_exec() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" -d "$TARGET_DB" "$@"
}

tables=$(psql_exec -tAc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';")
if [[ "$tables" != "0" ]]; then
  if [[ "${RESTORE_OVERWRITE:-}" == "1" ]]; then
    echo "target not empty ($tables tables): dropping public schema"
    psql_exec -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE;" -c "CREATE SCHEMA public;"
  else
    echo "refusing: target $TARGET_DB is not empty ($tables tables). Use RESTORE_OVERWRITE=1." >&2
    exit 1
  fi
fi

gunzip -c "$DUMP" | docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$TARGET_DB" -v ON_ERROR_STOP=1 -q -f -
echo "restored $DUMP into $TARGET_DB"
