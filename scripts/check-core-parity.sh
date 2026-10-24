#!/usr/bin/env bash
# Checks that apps/web domain/content files are re-export shims over @lifespire/core.
# Since #46 the single source of truth lives in packages/core/src; the web copies
# were replaced by one-line `export * from '@lifespire/core/...'` shims so all
# existing `../domain/*` and `../content/*` imports keep working.
# This script asserts the shim list (no duplicated implementations) and keeps the
# SCHEMA_VERSION cross-check until #49 wires the API to the core build output.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail=0

declare -A SHIMS=(
  ["apps/web/src/domain/balance.ts"]="@lifespire/core/domain/balance"
  ["apps/web/src/domain/content.ts"]="@lifespire/core/domain/content"
  ["apps/web/src/domain/dates.ts"]="@lifespire/core/domain/dates"
  ["apps/web/src/domain/generator.ts"]="@lifespire/core/domain/generator"
  ["apps/web/src/domain/goalIcons.ts"]="@lifespire/core/domain/goalIcons"
  ["apps/web/src/domain/lifecycle.ts"]="@lifespire/core/domain/lifecycle"
  ["apps/web/src/domain/mapDepth.ts"]="@lifespire/core/domain/mapDepth"
  ["apps/web/src/domain/rewards.ts"]="@lifespire/core/domain/rewards"
  ["apps/web/src/domain/rng.ts"]="@lifespire/core/domain/rng"
  ["apps/web/src/domain/runClose.ts"]="@lifespire/core/domain/runClose"
  ["apps/web/src/domain/schema.ts"]="@lifespire/core/domain/schema"
  ["apps/web/src/domain/selectors.ts"]="@lifespire/core/domain/selectors"
  ["apps/web/src/domain/types.ts"]="@lifespire/core/domain/types"
  ["apps/web/src/content/demo.ts"]="@lifespire/core/content/demo"
  ["apps/web/src/content/loot.ts"]="@lifespire/core/content/loot"
  ["apps/web/src/content/onboarding.ts"]="@lifespire/core/content/onboarding"
)

for file in "${!SHIMS[@]}"; do
  want="${SHIMS[$file]}"
  path="$ROOT/$file"
  if [[ ! -f "$path" ]]; then
    echo "FAIL: missing shim $file (expected re-export of $want)" >&2
    fail=1
    continue
  fi
  if ! grep -Eq "^export \* from '$want'$" "$path"; then
    echo "FAIL: $file is not a pure re-export of '$want'" >&2
    fail=1
    continue
  fi
  # Shims must not carry implementation: exactly one export statement plus comments/blank lines.
  exports=$(grep -c "^export " "$path" || true)
  if [[ "$exports" -ne 1 ]]; then
    echo "FAIL: $file has $exports export statements (expected exactly 1)" >&2
    fail=1
    continue
  fi
  echo "OK: $file -> $want"
done

# No other implementation files may live in the web domain/content dirs.
# Allowed: the shims above. Tests and fixtures live in @lifespire/core now.
for dir in "apps/web/src/domain" "apps/web/src/content"; do
  while IFS= read -r found; do
    rel="${found#$ROOT/}"
    if [[ -z "${SHIMS[$rel]:-}" ]]; then
      echo "FAIL: unexpected file $rel (web domain/content must only contain shims)" >&2
      fail=1
    fi
  done < <(find "$ROOT/$dir" -type f \( -name '*.ts' -o -name '*.json' \) | sort)
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
