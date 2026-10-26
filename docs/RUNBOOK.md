# Runbook (VPS)

Operational procedures for deploying, upgrading, backing up and recovering the
LifeSpire sync API and the web build it serves. Architecture, auth and sync
details live in [BACKEND.md](./BACKEND.md); sync decisions in [adr/](./adr/).

## 1. Local full stack

Local full stack with hot reload (single command, dev-only defaults):
`docker compose -f infra/docker-compose.local.yml up --build`
(web :5173, api :3000, db :5433).

## 2. Same-origin contract

Same-origin contract: the API serves the web build itself (`WEB_DIST_DIR`,
baked into the prod image as `/srv/web`) and answers `/v1/*`, `/health/*`
and `/docs*` on the same origin; the web calls `/v1` directly (same
origin) and a legacy `/api/*` strip-prefix rule points at the same backend.
No path-based routing is needed in front of it: an edge proxy just forwards
everything to the API.

The API sends the edge security headers, the legacy `/api` rewrite and
`Cache-Control: no-store` on API paths itself (independent of whether
`WEB_DIST_DIR` is set), and compresses text responses (gzip) so mode A does
not depend on the proxy for compression. The image runs as the unprivileged
`node` user (uid 1000). In the prod compose/image, `WEB_DIST_DIR` defaults to
`/srv/web`; set it to an empty value (`WEB_DIST_DIR=`) to serve the API only.
If it points at something that is not a usable build, the container refuses to
start before running migrations (fail fast).

## 3. Edge proxy

Two supported edges — pick one.

### A. Your own reverse proxy (e.g. Nginx Proxy Manager)

The prod compose binds no host ports 80/443, so it never fights your proxy. The
API port is published on loopback only (`127.0.0.1:3000`; override with
`API_BIND` / `API_PORT` when the proxy runs on another host).

Run these from the repository root. The compose project directory is `infra/`,
so a root-level `.env` must be passed explicitly with `--env-file .env`
(otherwise compose looks for `infra/.env`).

```bash
# first deploy
cp apps/api/.env.example .env   # fill secrets (openssl rand -base64 48)
docker compose --env-file .env -f infra/docker-compose.prod.yml up -d --build --remove-orphans
```

Migrations run automatically at container start (`prisma migrate deploy` in
the image `CMD`); there is no separate migration step.

Then create one Proxy Host (or equivalent) with:

- domain → `http://api:3000` when your proxy shares the `lifespire_internal`
  docker network (`docker network connect lifespire_internal <proxy>`), or
  → `http://<host-ip>:3000` with `API_BIND=<host-ip>` when it runs elsewhere;
- forward **everything** (`/`) — no per-path rules; the API routes internally;
- HTTPS on (the PWA and the `__Secure-` session cookie require it);
- proxy read/send timeouts ≥ 30 s: the sync watch is a 25 s long-poll
  (`SYNC_WATCH_TIMEOUT_MS`), shorter proxy timeouts break live sync;
- forward `Accept-Encoding`/`Content-Encoding` untouched (the API compresses
  itself; disabling compression at the proxy is fine, stripping the headers
  is not);
- `CORS_ORIGINS`/`PUBLIC_WEB_URL` in `.env` set to the public origin.

### B. Built-in Caddy (automatic HTTPS, no own proxy needed)

Adds Caddy in front via overlay — it terminates TLS (ACME with
`DOMAIN`/`ACME_EMAIL` from `.env`) and forwards everything to the API:

```bash
# first deploy
cp apps/api/.env.example .env   # fill secrets + DOMAIN + ACME_EMAIL
docker compose --env-file .env -f infra/docker-compose.prod.yml \
  -f infra/docker-compose.caddy.yml up -d --build
```

> Migration note: before the same-origin change the base prod file always
> started Caddy. To keep that behavior after updating, redeploy with the extra
> `-f infra/docker-compose.caddy.yml` flag (mode B above). Without it only
> `postgres` + `api` start — that is mode A, the new default. When switching
> from mode B to mode A, pass `--remove-orphans` (as in the mode A command) or
> run `down` first without `-v`: otherwise the old `caddy` container keeps
> publishing 80/443 and collides with your own proxy. `down` without `-v`
> keeps the `pgdata` volume.
>
> Rollback (deploy only; no client or data action): the Postgres data stays in
> the `pgdata` volume, untouched. Check out the previous release tag (or use
> the image tag you ran before) and `docker compose … up -d --build` again; do
> not rebuild the current branch when rolling back. If you came from the old
> bundled-Caddy setup, re-add the overlay (or point your own proxy back at the
> API). Keep `--env-file .env` and the overlay flag consistent when switching
> modes, and add `--remove-orphans` when you drop the overlay.

## 4. First admin and routine operations

```bash
# first admin: create it without a password (status PENDING), then print a
# one-time link to set the password
docker compose --env-file .env -f infra/docker-compose.prod.yml exec api node dist/cli/admin-create.js --email admin@example.com
docker compose --env-file .env -f infra/docker-compose.prod.yml exec api node dist/cli/admin-reset-link.js --email admin@example.com
# open the app → Settings → Sync → "Forgot your password?", paste the link,
# choose a 12+ character password, sign in and finish TOTP setup

# manual reset link for any user
docker compose --env-file .env -f infra/docker-compose.prod.yml exec api node dist/cli/admin-reset-link.js --email user@example.com

# backups (cron daily): infra/backup.sh, 30-day retention + optional restic
```

## 5. Health, metrics and restore drill

Health: `GET /health/live` (process), `GET /health/ready` (process + DB).
Metrics/logs: pino JSON in prod; sync pushes/conflicts are audit-logged and
counted (`GET /v1/admin/sync-metrics`).
Restore drill: monthly — `infra/restore.sh <dump.sql.gz>` into an empty
staging DB, then run the API e2e against it (last drill: 2026-10-24; evidence in
[BACKEND.md §9](./BACKEND.md#9-ops-evidence-2026-10-24-closes-47)).
