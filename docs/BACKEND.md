# LifeSpire Sync API (backend)

> Status: closed-beta foundation (PR `feat/backend-sync-foundation`).
> Scope: multi-user, closed registration, snapshot sync between a user's devices.
> Non-goals: public signup, email delivery, realtime, social, anti-cheat.

The web app stays **local-first**: without a configured server (or offline) it
plays as a guest from `localStorage`. The server is a versioned store with
authentication — it never simulates the game.

## 1. Layout

```text
apps/api/
  src/
    main.ts            bootstrap (helmet, cors, cookies, validation, docs)
    app.module.ts      global guards, throttler, logger
    config/env.ts      zod-validated environment
    common/            problem+json, ApiError, JwtAuthGuard, RolesGuard,
                       TotpAdminGuard, decorators, request-id
    prisma/            PrismaService (adapter-pg) + module
    auth/              login, accept-invite, refresh, logout, password,
                       TOTP setup/enable, Argon2id, invite tokens
    users/             GET/PATCH /v1/me, export, delete
    admin/             user CRUD, invites, resets, TOTP reset, audit
    devices/           list, revoke
    sync/              snapshot GET/PUT/DELETE, revisions
    health/            live/ready
    audit/             append-only admin/auth action log
    cli/               admin:create, admin:reset-link
  prisma/schema.prisma user/role/status, tokens, devices, sessions,
                       document/revisions/mutations, audit
packages/core/         pure domain shared conceptually with the web
                       (server validates structurally with zod; full rule
                       validation lives in the client until core ships a build)
packages/api-client/   dependency-free typed fetch client + conflict error
infra/                 prod compose (Caddy + API + Postgres), Caddyfile,
                       dev compose, backup.sh
```

## 2. Auth model

- **No public registration.** `POST /v1/auth/register` does not exist.
- Admins create `PENDING` users; the API returns a one-time invite link
  (`/accept-invite#token=…`, token in the fragment). The admin delivers it
  manually. Invites expire in 72 h and are single-use.
- Password resets are also manual links (`/reset-password#token=…`, 1 h,
  single-use, revokes all sessions on use).
- Passwords: Argon2id, 12–256 chars. Login errors are generic to avoid
  enumeration; disabled accounts get an explicit 403.
- Access: JWT 15 min (`sub`, `email`, `role`, `sid`, `did`, `totpVerified`).
- Refresh: opaque 32-byte token, sha256 in DB, HttpOnly cookie
  `__Secure-ls_rt` (`Secure` in prod, `SameSite=Lax`, `Path=/v1/auth`),
  rotated per use, 30-day expiry, family-based reuse detection (reuse revokes
  the whole family).
- **TOTP mandatory for admins.** Login without setup returns
  `totpSetupRequired: true`; `POST /v1/auth/totp/setup` returns an otpauth URL
  plus 10 hashed one-time recovery codes; admin routes require a verified
  session (`TotpAdminGuard`) and an enabled authenticator
  (`AdminService.requireAdmin` re-checks the DB so disable/demote/TOTP-reset
  take effect immediately). TOTP secrets are AES-256-GCM encrypted.
- Roles re-checked in DB on every admin call; the last active admin cannot be
  disabled, demoted or deleted (recovery via `admin:create` CLI on the server).
- Logout revokes one session; logout-all revokes all; password change/reset
  revokes all sessions.

## 3. Sync protocol (snapshot, `/v1`)

One `GameDocument` per user, monotonic `version` (bigint, exposed as string +
strong `ETag`).

| Method | Endpoint | Headers | Result |
|---|---|---|---|
| GET | `/v1/sync` | `If-None-Match` | `200` + doc, `304`, or `404` (no cloud save) |
| PUT | `/v1/sync` | `If-Match: "n"` + `Idempotency-Key: uuid` | `200` (+ new `ETag`) |
| PUT | `/v1/sync` | `If-None-Match: *` + `Idempotency-Key` | `201` first upload, `412` if a save exists |
| GET | `/v1/sync/revisions` | — | last 20 version metadata |
| DELETE | `/v1/sync` | — | `204`, clears cloud copy |

Rules:

- `Idempotency-Key` (uuid) is required. Same key + same content replays the
  recorded version; same key + different content is `422`.
- Identical content does not bump the version (checksum compare).
- Stale `If-Match` is `412 SYNC_VERSION_CONFLICT` with `currentVersion` /
  `currentUpdatedAt` (no document body; the client `GET`s it). **No auto-merge
  in v1** — the client shows an explicit keep-mine/keep-cloud dialog with
  backups (frontend work, next PR).
- Concurrent writers are serialized with an atomic compare-and-swap
  (`updateMany where version = expected`); exactly one wins, the other gets
  `412`.
- Writes keep the last 30 revisions and 7 days of idempotency keys.
- Documents are limited to 512 KB (`413`), requests to 1 MB.
- Schema gate: server accepts `schemaVersion 3`. Older is `426`
  (update the app); newer is `422` (update the server). Deploy the API before
  the web.
- Errors are `application/problem+json` with a stable `code`
  (`SYNC_VERSION_CONFLICT`, `AUTH_TOTP_REQUIRED`, …) and `traceId`.
- `Cache-Control: no-store` on sync; the PWA must never cache `/v1`/`/api`.

## 4. Time zones

`Run.timeZone` (schema v3, `string | null`) pins the zone new runs are created
in. All day boundaries (`createRun`, `openDay`, `resolveNode`, `reconcile`,
`cutoffAfter`) compute in that zone; legacy `null` runs keep device-local
behavior. The server never interprets dates — it stores the document.

## 5. Threat model (accepted)

- The server cannot verify real-world actions and does not try: a client can
  award itself XP. Protected instead: account takeover, cross-user reads
  (every query is scoped by JWT `sub`; e2e covers IDOR-adjacent paths),
  session theft (rotating refresh, reuse detection, revocation), and silent
  overwrites (versions + idempotency).
- Rate limits: 120 req/min global, 10/min login/invite, 5/min reset.
- Logs redact `authorization`, cookies, passwords and documents.
- Security headers via helmet + CSP/`frame-ancestors` at Caddy; same-origin
  `/api` proxy keeps cookies `SameSite=Lax` without CORS wildcard.

## 6. Runbook (VPS)

```bash
# first deploy
cp apps/api/.env.example /opt/lifespire/.env   # fill secrets (openssl rand -base64 48)
docker compose -f infra/docker-compose.prod.yml up -d --build
docker compose -f infra/docker-compose.prod.yml exec api npx prisma migrate deploy

# first admin (on the server)
docker compose -f infra/docker-compose.prod.yml exec api pnpm admin:create --email admin@example.com
# log in, complete TOTP setup, then create users from the admin panel/CLI

# manual reset link for a user
docker compose -f infra/docker-compose.prod.yml exec api pnpm admin:reset-link --email user@example.com

# backups (cron daily): infra/backup.sh, 30-day retention + optional restic
```

Health: `GET /health/live` (process), `GET /health/ready` (process + DB).
Metrics/logs: pino JSON in prod; sync pushes/conflicts are audit-logged.
Restore drill: monthly — restore a `backup.sh` dump to staging and run the
API e2e against it.

## 7. Testing

- `pnpm --filter @lifespire/api test` — 26 unit tests (versions, crypto,
  invites, TOTP adapter, env, structural gate). No DB needed.
- `pnpm --filter @lifespire/api test:e2e` — full flow against Postgres:
  admin TOTP, invite lifecycle, sync create/304/no-op bump/conflict/replay/
  key-reuse/revisions, device revoke, disable, last-admin guard.
- Dev DB: `docker compose -f infra/docker-compose.dev.yml up -d`, then
  `DATABASE_URL=… pnpm --filter @lifespire/api prisma:migrate`.

## 8. Follow-ups (not in this PR)

- Web sync engine + conflict dialog + per-account local keys (`M5-client`).
- `@lifespire/core` build output so the server can import full rule validation.
- Web move is done (`apps/web`); `src/domain` ↔ `packages/core` dedup
  (re-export shims) is still open.
- Journal/operation sync if conflicts hurt in real use (see ADR-0001).
