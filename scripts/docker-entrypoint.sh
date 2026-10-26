#!/bin/sh
# Container entrypoint: reject a bad WEB_DIST_DIR before touching the database,
# then apply migrations and start the API. The same check runs again in
# `resolveWebBuild` as a defence in depth.
set -eu
if [ -n "${WEB_DIST_DIR:-}" ] && [ ! -f "${WEB_DIST_DIR}/index.html" ]; then
  echo "WEB_DIST_DIR is set but unusable: ${WEB_DIST_DIR} (expected a directory containing index.html)" >&2
  exit 1
fi
./node_modules/.bin/prisma migrate deploy
exec node dist/main
