#!/usr/bin/env bash
# Checks that the web's domain/content sources stay in parity with @lifespire/core.
# Usage: scripts/check-core-parity.sh [extra-exclude ...]
# Each extra arg is an additional diff --exclude pattern (e.g. a filename
# that is intentionally allowed to diverge). By default *.test.ts and the
# fixtures directories are excluded from the comparison.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

EXCLUDES=(--exclude=*.test.ts --exclude=fixtures)
for extra in "$@"; do
  EXCLUDES+=(--exclude="$extra")
done

fail=0

for pair in "apps/web/src/domain:packages/core/src/domain" "apps/web/src/content:packages/core/src/content"; do
  web="${pair%%:*}"
  core="${pair##*:}"
  if out=$(diff -rq "${EXCLUDES[@]}" "$ROOT/$web" "$ROOT/$core" 2>&1); then
    echo "OK: $web matches $core"
  else
    echo "FAIL: $web differs from $core" >&2
    echo "$out" >&2
    fail=1
  fi
done

core_version=$(grep -Eo 'export const SCHEMA_VERSION = [0-9]+' "$ROOT/packages/core/src/domain/balance.ts" | grep -Eo '[0-9]+')
server_version=$(grep -Eo 'const SERVER_SCHEMA_VERSION = [0-9]+' "$ROOT/apps/api/src/sync/sync.service.ts" | grep -Eo '[0-9]+')

if [[ -z "${core_version:-}" || -z "${server_version:-}" ]]; then
  echo "FAIL: could not parse SCHEMA_VERSION ($core_version) or SERVER_SCHEMA_VERSION ($server_version)" >&2
  fail=1
elif [[ "$core_version" != "$server_version" ]]; then
  echo "FAIL: SCHEMA_VERSION ($core_version) != SERVER_SCHEMA_VERSION ($server_version)" >&2
  fail=1
else
  echo "OK: SCHEMA_VERSION ($core_version) matches SERVER_SCHEMA_VERSION ($server_version)"
fi

exit "$fail"
