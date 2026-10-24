FROM node:24-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile --filter @lifespire/api...

FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @lifespire/api prisma:generate
RUN pnpm --filter @lifespire/api build
RUN pnpm --filter @lifespire/api --prod deploy /prod/api

FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /srv/api
COPY --from=build /prod/api/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/prisma.config.ts ./
COPY --from=build /app/apps/api/package.json ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
