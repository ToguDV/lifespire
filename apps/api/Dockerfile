# syntax=docker/dockerfile:1
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
# @prisma/client (the store-derived path is computed by the shared script).
RUN cp -r "$(sh scripts/prisma-client-dir.sh /app/apps/api)" /tmp/dot-prisma

FROM node:24-alpine AS runner
ENV NODE_ENV=production
# The image ships the web build; set WEB_DIST_DIR empty to serve the API only.
ENV WEB_DIST_DIR=/srv/web
WORKDIR /srv/api
COPY --chown=node:node --from=build /prod/api/node_modules ./node_modules
COPY --chown=node:node --from=build /app/apps/api/dist ./dist
COPY --chown=node:node --from=build /app/apps/api/prisma ./prisma
COPY --chown=node:node --from=build /app/apps/api/prisma.config.ts ./
COPY --chown=node:node --from=build /app/apps/api/package.json ./
COPY --chown=node:node --from=build /app/apps/web/dist /srv/web
COPY --chown=node:node --from=build /app/scripts/prisma-client-dir.sh ./scripts/prisma-client-dir.sh
COPY --chown=node:node --from=build /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh
# Restore the generated Prisma client next to the deployed @prisma/client,
# where it resolves it from (see build stage). The bind mount keeps the
# temporary copy out of the image layers.
RUN --mount=type=bind,from=build,source=/tmp/dot-prisma,target=/tmp/dot-prisma \
  DEST="$(sh scripts/prisma-client-dir.sh /srv/api)" \
  && mkdir -p "$DEST" \
  && cp -r /tmp/dot-prisma/. "$DEST/" \
  && chown -R node:node "$DEST"
# Unprivileged: the same process serves the public web build and opens the DB.
USER node
EXPOSE 3000
# prisma is a runtime dependency, so this uses the pinned local CLI instead of
# downloading one at boot. The entrypoint fails before migrating if
# WEB_DIST_DIR is configured but unusable.
CMD ["sh", "./docker-entrypoint.sh"]
