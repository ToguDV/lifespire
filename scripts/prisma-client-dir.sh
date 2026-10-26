#!/bin/sh
# Prints the generated Prisma client directory for an installed @prisma/client.
# With pnpm, @prisma/client is a symlink into the virtual store and
# `prisma generate` writes `.prisma` next to its realpath. Deriving it here
# keeps the Dockerfile independent of store hashes and Prisma's layout.
set -eu
client="$(readlink -f "$1/node_modules/@prisma/client")"
printf '%s\n' "$(dirname "$client")/../.prisma"
