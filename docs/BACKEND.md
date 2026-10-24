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
packages/core/         pure domain, source of truth (CJS build at dist/cjs
                       for the server; TS sources for Vite/Vitest). The API
                       enforces full game-rule validation via parseDocument;
                       see ADR-0003.
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
- Logout revokes one session; logout-all revokes all; password change
  (`POST /v1/auth/password`) and password reset both revoke all sessions
  (all devices must log in again).

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
- Documents are limited to 512 KB (`413` document gate); request bodies are
  limited to 1 MB (Express JSON parser limit, `413` on overflow).
- Schema gate: server accepts `schemaVersion 3`. Older is `426`
  (update the app); newer is `422` (update the server). A structurally valid
  document that breaks game rules is `422 SYNC_RULE_VIOLATION` with the core
  error in `detail`. Deploy the API before the web.
- Errors are `application/problem+json` with a stable `code`
  (`SYNC_VERSION_CONFLICT`, `AUTH_TOTP_REQUIRED`, …) and `traceId`.
- Observability: every write-path outcome (`created`, `updated`, `noop`,
  `replayed`, `conflict`) is counted in `SyncMetrics`, logged as a structured
  `sync.push` pino line (`outcome`, `bytes`, `latencyMs`, `version` — no user
  content), and readable at `GET /v1/admin/sync-metrics` (admin only).
  Validation rejections (400/413/422-shape/422-rule) are client errors, not
  pushes, and stay out of the counters.
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
- Accepted tradeoff: disabled accounts are enumerable via the login `403`
  (anyone holding valid credentials for a disabled account can distinguish it
  from a bad-password `401`); accepted so operators and users get a clear
  disabled signal instead of a misleading generic error.
- Stateless access tokens live up to 15 min after logout, password change or
  disable: only refresh sessions are revoked server-side. Every authenticated
  handler re-checks `status === 'ACTIVE'` (`requireActiveUser`), so a disabled
  account loses sync/devices/export/me immediately; in-flight access tokens
  stop working at expiry. No per-request session lookup by design (push-path
  cost, see §9).
- Security headers via helmet + CSP/`frame-ancestors` at Caddy; same-origin
  contract: the web calls `/v1` directly and Caddy proxies `/v1`, `/health`
  and `/docs` to the API (plus a legacy `/api` strip-prefix rule), so cookies
  stay `SameSite=Lax` without a CORS wildcard.

## 6. Runbook (VPS)

Local full stack with hot reload (single command, dev-only defaults):
`docker compose -f infra/docker-compose.local.yml up --build`
(web :5173, api :3000, db :5433).

Same-origin contract: the web build calls `/v1` directly (same origin);
Caddy proxies `/v1/*`, `/health/*` and `/docs*` to `api:3000`, and keeps a
legacy `/api/*` strip-prefix rule pointing at the same backend.

```bash
# first deploy
cp apps/api/.env.example /opt/lifespire/.env   # fill secrets (openssl rand -base64 48)
docker compose -f infra/docker-compose.prod.yml up -d --build
docker compose -f infra/docker-compose.prod.yml exec api npx prisma migrate deploy

# first admin (on the server; the prod image has no pnpm/ts-node, the CLIs
# run from the compiled dist — build first with pnpm --filter @lifespire/api build)
docker compose -f infra/docker-compose.prod.yml exec api node dist/cli/admin-create.js --email admin@example.com
# log in, complete TOTP setup, then create users from the admin panel/CLI

# manual reset link for a user
docker compose -f infra/docker-compose.prod.yml exec api node dist/cli/admin-reset-link.js --email user@example.com

# backups (cron daily): infra/backup.sh, 30-day retention + optional restic
```

Health: `GET /health/live` (process), `GET /health/ready` (process + DB).
Metrics/logs: pino JSON in prod; sync pushes/conflicts are audit-logged and
counted (`GET /v1/admin/sync-metrics`).
Restore drill: monthly — `infra/restore.sh <dump.sql.gz>` into an empty
staging DB, then run the API e2e against it (last drill: §9, 2026-10-24).

## 7. Testing

- `pnpm --filter @lifespire/api test` — 33 unit tests (versions, crypto,
  invites, TOTP adapter, env, structural + rule gates, metrics counters). No DB needed.
- `pnpm --filter @lifespire/api test:e2e` — 11 flows against Postgres:
  (a) admin TOTP, invite lifecycle, sync create/304/no-op bump/conflict/
  replay/key-reuse/revisions, device revoke, disable, last-admin guard;
  (b) password-reset link (single-use, revokes sessions); (c) TOTP
  required/wrong-code/recovery-code single-use; (d) sync validation gates
  (headers, 512 KB document cap, schema 426/422, malformed 422,
  rule-violation 422 via core);
  (e) expired invite; (f) refresh reuse kills the family; (g) concurrent
  writers/refreshes (one wins); (h) admin self-delete (last blocked 400,
  second 204); (i) audit pagination 400 on bad page; (j) totp/enable
  throttle 429; (k) sync metrics count pushes and conflicts.
- Dev DB: `docker compose -f infra/docker-compose.dev.yml up -d`, then
  `DATABASE_URL=… pnpm --filter @lifespire/api prisma:migrate`.

## 8. Follow-ups (not in this PR)

- Web sync engine + conflict dialog + per-account local keys (`M5-client`,
  calling `/v1` same-origin per the §6 contract).
- Web move is done (`apps/web`); `src/domain` ↔ `packages/core` dedup
  (re-export shims) landed in #46 — web files are one-line shims, core is
  the source of truth.
- Journal/operation sync if conflicts hurt in real use (see ADR-0001).

## 9. Ops evidence (2026-10-24, closes #47)

Local runs on a laptop (prod `node dist/main`, Docker Postgres 17). Not a
staging baseline — rerun on VPS hardware before trusting the numbers.

### Restore drill: pass

1. Dumped the live dev DB in `backup.sh` format (9 users, 4 docs, 6
   revisions, 42 audit rows).
2. Created an empty `lifespire_restored` DB and ran
   `TARGET_DB=lifespire_restored infra/restore.sh <dump>` — data matched
   (9/4/6), no migrate involved.
3. Ran `pnpm --filter @lifespire/api test:e2e` with
   `DATABASE_URL=…/lifespire_restored`: 11/11 pass.
4. `restore.sh` refuses a non-empty target unless `RESTORE_OVERWRITE=1`
   (verified), and refuses prod compose files without
   `ALLOW_PROD_RESTORE=1`.

### Load test: RED on the p95 gate (follow-ups filed)

k6 (`infra/load/sync-push.js`, 100 VUs, ~306 KB rule-valid docs, one push
each; `infra/load/seed.mjs` pre-seeds users + mints tokens):

| Phase | Result | Client p95 | Server-side avg |
|---|---|---|---|
| create burst (`If-None-Match: *`) | 100/100 × 201 | 1.29 s | ~290 ms |
| update burst (`If-Match: "1"`, write path) | 100/100 × 200 | 1.54 s | ~776 ms |

Gate was p95 push < 300 ms. Writes cost more (3-row transaction + revision
pruning + audit row); under 100-way concurrency a single Node process plus
JSON parse/validation per 300 KB doc dominates. Staging re-run + push-path
profiling are follow-ups.

### Throttle finding (follow-up filed)

The global 120 req/min bucket is per source IP with no trust-proxy: behind
Caddy every client shares one bucket, and even local k6 bursts must be
paced ~60 s apart to stay under it. Per-user/per-route throttle keying needs
a decision before any real load arrives.
