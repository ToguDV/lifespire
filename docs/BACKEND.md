# LifeSpire Sync API (backend)

> Status: closed-beta foundation (PR `feat/backend-sync-foundation`).
> Scope: multi-user, closed registration, snapshot sync between a user's devices,
> near-real-time change feed while the app is open.
> Non-goals: public signup, email delivery, remote push notifications (closed
> app), social, anti-cheat.

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
                       TOTP setup/enable, Argon2id, invite tokens, native
                       client gate (ADR-0005)
    users/             GET/PATCH /v1/me, export, delete
    admin/             user CRUD, invites, resets, TOTP reset, audit
    devices/           list, revoke
    sync/              snapshot GET/PUT/DELETE, revisions, long-poll change
                       feed (watch)
    health/            live/ready
    audit/             append-only admin/auth action log
    cli/               admin:create, admin:reset-link
  prisma/schema.prisma user/role/status, tokens, devices, sessions,
                       document/revisions/mutations, audit
apps/mobile/           Expo Android app; shares app-core and native auth
apps/desktop/          Electron shell; main-process API proxy and safeStorage
packages/core/         pure domain, source of truth (CJS build at dist/cjs
                       for the server; TS sources for Vite/Vitest/Metro). The
                       API enforces full game-rule validation via parseDocument;
                       see ADR-0003.
packages/app-core/     shared store/persistence/sync/UI helpers
packages/api-client/   dependency-free typed fetch client + conflict error
infra/                 prod compose (API + Postgres, opt-in Caddy overlay),
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
- **Native grant (ADR-0005):** a request is native only with
  `X-Client-Platform: android|ios|desktop` and no `Origin`/`Sec-Fetch-Site`
  headers. Those browser-forbidden headers cannot be removed by page
  JavaScript, so web keeps the HttpOnly cookie and cannot opt into the body
  token. Native login/accept-invite return `refreshToken`; native refresh
  accepts `{ refreshToken }`. Rotation, hashing, family reuse detection and
  revocation are identical. `desktop` is the Electron main process: it calls
  from a dedicated in-memory session whose Fetch Metadata headers are stripped
  before sending, keeps the token out of the renderer and stores it with
  Electron `safeStorage`; see `DESKTOP.md` §5.
- Refresh: opaque 32-byte token, sha256 in DB, HttpOnly cookie
  `__Secure-ls_rt` (`Secure` in prod, `SameSite=Lax`, `Path=/v1/auth`),
  rotated per use, 30-day expiry, family-based reuse detection (reuse revokes
  the whole family). Native clients store the same token in the OS keychain and
  send it in the refresh body; they do not receive a cookie. Desktop is
  memory-only when `safeStorage` cannot encrypt (no keyring or Linux
  `basic_text`), never a plaintext cookie or localStorage fallback.
- **TOTP mandatory for admins.** Login without setup returns
  `totpSetupRequired: true`; `POST /v1/auth/totp/setup` returns an otpauth URL
  plus 10 hashed one-time recovery codes; admin routes require a verified
  session (`TotpAdminGuard`) and an enabled authenticator
  (`AdminService.requireAdmin` re-checks the DB so disable/demote/TOTP-reset
  take effect immediately). TOTP secrets are AES-256-GCM encrypted.
- Roles re-checked in DB on every admin call; the last active admin cannot be
  disabled, demoted or deleted (recovery via `admin:create` CLI on the server).
- Logout revokes the **refresh family** of the presented session (every
  rotation of that device, even if an access token still points at an older
  sid); logout-all revokes every family of the user; password change
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
| GET | `/v1/sync/watch` | `since` (version, optional) | `200` + `{version, updatedAt}` when changed or when the wait expires; `version: null` when there is no cloud save |
| DELETE | `/v1/sync` | — | `204`, clears cloud copy |

Rules:

- `Idempotency-Key` (uuid) is required. Same key + same content replays the
  recorded version; same key + different content is `422`.
- Identical content does not bump the version (checksum compare).
- Stale `If-Match` is `412 SYNC_VERSION_CONFLICT` with `currentVersion` /
  `currentUpdatedAt` (no document body; the client `GET`s it). Conservative
  auto-merge (ADR-0004): the client tries a 3-way merge of disjoint edits
  against its last-synced base and pushes the result; anything ambiguous still
  opens the explicit keep-mine/keep-cloud dialog with backups and merge reasons.
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
- **Change feed (`GET /v1/sync/watch`, ADR-0006):** a version-only long-poll.
  It returns immediately if the cloud is newer than `since`, otherwise holds up
  to `SYNC_WATCH_TIMEOUT_MS` (25 s, max 30 s) and wakes when a push or delete
  for the same user commits. The event carries only `{version, updatedAt}`
  (never the document); the client then pulls with its ETag. On timeout the
  handler re-reads the version, so an API restart or a second replica still
  catches up within one wait. `DELETE` notifies `version: null`.
- The notifier is in-process: one API process gets instant fanout; horizontal
  scaling needs Postgres `LISTEN/NOTIFY` or Redis (follow-up). The watch route
  is excluded from the global throttle (a long-poll would consume the shared
  120/min IP bucket) and bounds itself per user instead: 16 concurrent watchers
  and 60 opens/minute (`429 SYNC_WATCH_LIMIT`). It is authenticated, `no-store`,
  and excluded from the pino access log. `wait` (250–30 000 ms, clamped to
  `SYNC_WATCH_TIMEOUT_MS`) exists for tests and short-lived clients.
- Clients stop the feed when hidden/backgrounded and pull once on resume;
  mobile foreground changes propagate after the normal 1.5 s push debounce.
  A 40 s client watchdog aborts a zombie long-poll (laptop sleep, NAT rebind,
  a proxy holding the response) and rejoins the loop. Old servers without the
  endpoint (404/405/501) make new clients fall back to the 60 s poll. Deploy the
  API before the web, as before.
- `version: null` means another device deleted the cloud copy. The receiving
  client keeps its local save, drops the stale cursor/meta and recreates the
  cloud copy on its next edit; nothing is deleted silently.

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
- Native token gate: the header is spoofable in principle, but the absence of
  `Origin`/`Sec-Fetch-Site` is what keeps the token out of browser JavaScript.
  This is a closed-beta tradeoff; a PKCE/Custom Tab flow is the long-term path
  if third-party clients appear. The refresh token is never logged. On desktop
  the IPC boundary is the second layer: only the main process can call the API
  with `desktop`, from a dedicated `lifespire-api` session that strips
  `Sec-Fetch-Site`/`Origin`/`Referer`; the renderer cannot reach that session,
  and the proxy response has the token stripped.
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
- Security headers via helmet on API responses plus CSP/`frame-ancestors`
  on the served web build (sent by the API itself; defined in
  `apps/api/src/spa/spa.ts`); same-origin contract: the web calls
  `/v1` directly and the API serves the SPA plus `/v1`, `/health` and
  `/docs` from one origin (plus a legacy `/api` strip-prefix rule), so
  cookies stay `SameSite=Lax` without a CORS wildcard.

## 6. Runbook (VPS)

Local full stack with hot reload (single command, dev-only defaults):
`docker compose -f infra/docker-compose.local.yml up --build`
(web :5173, api :3000, db :5433).

Same-origin contract: the API serves the web build itself (`WEB_DIST_DIR`,
baked into the prod image as `/srv/web`) and answers `/v1/*`, `/health/*`
and `/docs*` on the same origin; the web calls `/v1` directly (same
origin) and a legacy `/api/*` strip-prefix rule points at the same backend.
No path-based routing is needed in front of it: an edge proxy just forwards
everything to the API.

Two supported edges — pick one:

**A. Your own reverse proxy (e.g. Nginx Proxy Manager).** The prod compose
binds no host ports 80/443, so it never fights your proxy. The API port is
published on loopback only (`127.0.0.1:3000`; override with `API_BIND` /
`API_PORT` when the proxy runs on another host).

```bash
# first deploy
cp apps/api/.env.example /opt/lifespire/.env   # fill secrets (openssl rand -base64 48)
docker compose -f infra/docker-compose.prod.yml up -d --build
docker compose -f infra/docker-compose.prod.yml exec api npx prisma migrate deploy
```

Then create one Proxy Host (or equivalent) with:

- domain → `http://api:3000` when your proxy shares the `lifespire_internal`
  docker network (`docker network connect lifespire_internal <proxy>`), or
  → `http://<host-ip>:3000` with `API_BIND=<host-ip>` when it runs elsewhere;
- forward **everything** (`/`) — no per-path rules; the API routes internally;
- HTTPS on (the PWA and the `__Secure-` session cookie require it);
- proxy read/send timeouts ≥ 30 s: the sync watch is a 25 s long-poll
  (`SYNC_WATCH_TIMEOUT_MS`), shorter proxy timeouts break live sync;
- `CORS_ORIGINS`/`PUBLIC_WEB_URL` in `.env` set to the public origin.

**B. Built-in Caddy (automatic HTTPS, no own proxy needed).** Adds Caddy in
front via overlay — it terminates TLS (ACME with `DOMAIN`/`ACME_EMAIL` from
`.env`) and forwards everything to the API:

```bash
# first deploy
cp apps/api/.env.example /opt/lifespire/.env   # fill secrets + DOMAIN + ACME_EMAIL
docker compose -f infra/docker-compose.prod.yml -f infra/docker-compose.caddy.yml up -d --build
docker compose -f infra/docker-compose.prod.yml exec api npx prisma migrate deploy
```

> Migration note: before this change the base prod file always started
> Caddy. To keep that behavior after updating, redeploy with the extra
> `-f infra/docker-compose.caddy.yml` flag (mode B above). Without it only
> `postgres` + `api` start — that is mode A, the new default.

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

- `pnpm --filter @lifespire/api test` — unit tests (versions, crypto,
  invites, TOTP adapter, env, structural + rule gates, metrics counters, native
  client gate, watch waiters/timeout/cap). No DB needed.
- `pnpm --filter @lifespire/api-client test` covers cookie mode, native token
  capture/rotation, refusal without a stored token, the injectable transport
  and the watch cursor query.
- `pnpm --filter @lifespire/desktop test` covers the main-process proxy
  (path/header/body/origin allowlists and sender gate), link-local blocking,
  response-size gates, refresh-token stripping/rotation, the long-poll watch
  timeout, the generation/single-flight races and the safeStorage vault
  (including the memory-only fallback and atomic persistence).
- `pnpm --filter @lifespire/mobile test` covers the local notification planner.
  The Postgres flow also exercises the `desktop` login/refresh pair and the
  browser-shaped rejection.
- `pnpm --filter @lifespire/api test:e2e` — 14 flows against Postgres:
  (a) admin TOTP, invite lifecycle, sync create/304/no-op bump/conflict/
  replay/key-reuse/revisions, device revoke, disable, last-admin guard;
  (b) password-reset link (single-use, revokes sessions); (c) TOTP
  required/wrong-code/recovery-code single-use; (d) sync validation gates
  (headers, 512 KB document cap, schema 426/422, malformed 422,
  rule-violation 422 via core);
  (e) expired invite; (f) refresh reuse kills the family; (g) concurrent
  writers/refreshes (one wins); (h) admin self-delete (last blocked 400,
  second 204); (i) audit pagination 400 on bad page; (j) totp/enable
  throttle 429; (k) sync metrics count pushes and conflicts; (l) native
  `desktop` login/refresh plus the browser-shaped rejection; (m) logout
  revokes the rotated family even from an older access token; (n) the watch
  feed wakes on a same-user push, returns the current version on timeout, does
  not cross users, wakes with `version: null` on delete and rejects anonymous
  calls.
- `apps/web/e2e/sync.spec.ts` asserts that a push from one browser context
  reaches the other **without a reload** (watch feed + toast), alongside the
  conflict and auto-merge flows.
- Dev DB: `docker compose -f infra/docker-compose.dev.yml up -d`, then
  `DATABASE_URL=… pnpm --filter @lifespire/api prisma:migrate`.

## 8. Follow-ups (not in this PR)

- **Logout family revocation is not transactional with a concurrent refresh.**
  A refresh that commits between `logout`'s family lookup and its
  `updateMany` can leave one newer row alive; closing that window needs a
  family-level lock or state migration. The desktop proxy mitigates the local
  case by aborting in-flight refreshes before sending logout.
- Journal/operation sync if conflicts still hurt in real use (see ADR-0001).
- **Multi-instance change feed:** the watcher registry is in-process. Adding a
  second API replica needs Postgres `LISTEN/NOTIFY` or Redis fanout; until
  then, clients attached to another replica catch up on the 25 s timeout.
- **SSE** if the client count or event types outgrow one long-poll per device.
- Remote push (APNs/FCM/Expo Push) is intentionally out of scope; local
  reminders need no server registration. Real-time changes only apply while
  the app is open.

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
the edge proxy every client shares one bucket, and even local k6 bursts must be
paced ~60 s apart to stay under it. Per-user/per-route throttle keying needs
a decision before any real load arrives.
