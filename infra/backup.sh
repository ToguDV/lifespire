#!/usr/bin/env bash
# Daily Postgres backup for the LifeSpire VPS. Keeps 30 days locally and
# optionally syncs to external storage via restic (set RESTIC_REPOSITORY).
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/lifespire}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/lifespire-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"
docker compose -f /opt/lifespire/infra/docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-lifespire}" "${POSTGRES_DB:-lifespire}" | gzip > "$FILE"
find "$BACKUP_DIR" -name 'lifespire-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

if [ -n "${RESTIC_REPOSITORY:-}" ]; then
  restic backup "$FILE"
  restic forget --keep-daily 30 --keep-weekly 8 --prune
fi

echo "backup written to $FILE"
