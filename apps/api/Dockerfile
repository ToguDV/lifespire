FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
# Single COPY before install: pnpm 11 revalidates node_modules against file
# mtimes, so installing from a manifest-only snapshot and COPYing sources
# afterwards always invalidates the tree (patchedDependencies included).
COPY . .
RUN pnpm install --frozen-lockfile --filter @lifespire/api... --filter @lifespire/web...
# prisma.config.ts resolves env(DATABASE_URL) at generate time (no connection
# is opened); the dummy value is build-only and never baked into the image.
RUN DATABASE_URL=postgresql://lifespire:lifespire@localhost:5432/lifespire \
  pnpm --filter @lifespire/api prisma:generate
RUN pnpm --filter @lifespire/web build
RUN pnpm --filter @lifespire/api build
# --legacy: pnpm >= 10 only deploys from inject-workspace-packages workspaces;
# legacy deploy keeps the original pruned node_modules behavior.
RUN pnpm --filter @lifespire/api --prod deploy --legacy /prod/api
# pnpm deploy does not carry the generated Prisma client (.prisma is not part
# of any package). Stage it; the runner restores it next to its own
# @prisma/client (store hashes are derived, never hardcoded).
RUN cp -r "$(dirname "$(readlink -f /app/apps/api/node_modules/@prisma/client)")/../.prisma" /tmp/dot-prisma

FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /srv/api
COPY --from=build /prod/api/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/prisma.config.ts ./
COPY --from=build /app/apps/api/package.json ./
COPY --from=build /app/apps/web/dist /srv/web
# Restore the generated Prisma client next to the deployed @prisma/client,
# where it resolves it from (see build stage).
COPY --from=build /tmp/dot-prisma /tmp/dot-prisma
RUN DEST="$(dirname "$(readlink -f node_modules/@prisma/client)")/../.prisma" \
  && mkdir -p "$DEST" && cp -r /tmp/dot-prisma/. "$DEST/" && rm -rf /tmp/dot-prisma
EXPOSE 3000
# prisma is a runtime dependency, so this uses the pinned local CLI instead of
# downloading one at boot.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main"]
