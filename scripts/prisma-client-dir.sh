#!/bin/sh
# Prints the generated Prisma client directory for an installed @prisma/client.
# With pnpm, @prisma/client is a symlink into the virtual store and
# `prisma generate` writes `.prisma` next to its realpath. Deriving it here
# keeps the Dockerfile independent of store hashes and Prisma's layout.
set -eu
client="$(readlink -f "$1/node_modules/@prisma/client" 2>/dev/null || true)"
if [ -z "$client" ]; then
  # macOS readlink has no -f; resolve through the directory instead.
  client="$(cd "$1/node_modules/@prisma/client" && pwd -P)"
fi
printf '%s\n' "$(dirname "$client")/../.prisma"
