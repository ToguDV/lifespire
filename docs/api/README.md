# API `/v1` — Conventions and contract

> **Status:** target contract (specification v1.0, frozen 2026-10-18). The definitive OpenAPI will be generated during implementation (M2).
> This document defines conventions, modules, endpoints and flows. The details of the sync engine are in [`sync-offline.md`](../sync-offline.md); the entity model in [`data-model.md`](../data-model.md).

---

## 1. General conventions

| Topic | Rule |
|---|---|
| Base URL | `https://api.lifespire.app/v1` (dev: `http://localhost:3000/v1`) |
| Format | JSON (`application/json`), fields in `camelCase` |
| Dates | ISO-8601 in UTC (`2026-10-18T14:03:00Z`); `dayKey` values (`YYYY-MM-DD`) are in the user's time zone |
| Versioning | Route prefix `/v1`; breaking changes → `/v2` with a coexistence period |
| Auth | `Authorization: Bearer <accessToken>` (15-min JWT) + rotating refresh |
| Idempotency | `clientOpId` (UUIDv7) in game operations; `Idempotency-Key` in economy POSTs. Replay → **200 with the original result** |
| Pagination | Cursor: `?cursor=<opaque>&limit=50` → `{ items: [...], nextCursor: string \| null }` |
| Errors | Single shape (below) with a stable `code` for the client |
| Rate limit | Per user; `Retry-After` headers on 429 |
| WebSocket | `/v1/sync/stream` (socket.io): only signals changes → the client does a `pull` |

### Error shape

```json
{
  "error": {
    "code": "INSUFFICIENT_GOLD",
    "message": "You do not have enough gold for this purchase.",
    "details": { "required": 90, "available": 62 },
    "requestId": "req_01J..."
  }
}
```

### Error codes

| `code` | HTTP | Meaning |
|---|---|---|
| `AUTH_REQUIRED` / `TOKEN_EXPIRED` | 401 | Missing token or expired (the client attempts a refresh) |
| `FORBIDDEN` | 403 | Resource belonging to another user |
| `NOT_FOUND` | 404 | Nonexistent resource |
| `VALIDATION_ERROR` | 422 | Invalid payload (per-field details) |
| `INVALID_STATE` | 409 | Operation not valid for the current state (e.g. timer already started) |
| `ALREADY_RESOLVED` | 409 | The resource was already resolved with a different result (conflict between devices) |
| `SEED_SALT_ALREADY_SET` | 409 | `PUT /users/me/seed-salt` when the account already has a different, immutable salt |
| `INSUFFICIENT_GOLD` / `ITEM_NOT_OWNED` | 409 | Material requirements not met |
| `RATE_LIMITED` / `DAILY_LIMIT` | 429 | Excess requests or daily limit (evidence, AI) |
| `AI_UNAVAILABLE` | 503 | AI provider down or kill switch active (use fallback) |
| `AI_BUDGET_EXCEEDED` | 429 | User's token budget exhausted (renews on day 1) |
| `SYNC_CURSOR_INVALID` | 400 | Pull cursor expired → do a full re-sync |

---

## 2. Modules and endpoints

> The "Module" column references the NestJS modules from [`ARCHITECTURE.md`](../../ARCHITECTURE.md#61-modules).

### 2.1 `auth`

| Method and route | Description |
|---|---|
| `POST /auth/register` | `{ email, password, name }` → tokens |
| `POST /auth/login` | `{ email, password }` → `{ accessToken, refreshToken }` |
| `POST /auth/refresh` | Refresh rotation; reuse detected → revoke family |
| `POST /auth/logout` | Revokes the current refresh |
| `POST /auth/password/forgot` · `POST /auth/password/reset` | Recovery |
| `GET /auth/devices` · `DELETE /auth/devices/:id` | List and remote revocation |

### 2.2 `users`

| Method and route | Description |
|---|---|
| `GET /users/me` · `PATCH /users/me` | Profile (`name`, `timezone`, `dayCloseHour`, `vacationMode`); `GET` also returns `seedSalt` (32 bytes hex) |
| `PUT /users/me/seed-salt` | Adopts the client's local salt: body `{ "seedSalt": "<64 hex chars>" }`; idempotent → `204` if it is set or already matches, `409 SEED_SALT_ALREADY_SET` if the account already has a different salt |
| `GET /users/me/settings` · `PATCH` | Notifications, evidence retention, preferences |
| `GET /users/me/wallet` | `{ gold, level, xp, xpToNext, streak, freezesLeft }` |
| `GET /users/me/stats` · `POST` · `PATCH /:id` | Custom stats (effect pool from GDD §9.2) |
| `POST /users/me/stats/:id/points` | Assign a level-up point |
| `GET /users/me/skills` · `POST` · `PATCH /:id` · `DELETE /:id` | Skills: create, rename, archive |
| `GET /users/me/export` | Full JSON export (async job → download) |
| `DELETE /users/me` | Account deletion with purge (DB + storage) |

`PUT /users/me/seed-salt` exists to migrate local M0 data into the account; once set, the salt is **never rotated** (see `docs/adr/0015-local-first-seed-salt.md`).

### 2.3 `goals`

| Method and route | Description |
|---|---|
| `GET /goals` · `POST /goals` · `GET/PATCH/DELETE /goals/:id` | Goals (state: `active`, `paused`, `achieved`, `archived`) |
| `GET /goals/:id/milestones` · `POST /goals/:id/milestones` | Milestones of a goal |
| `PATCH /milestones/:id` · `DELETE /milestones/:id` | Reschedule, close, delete |

### 2.4 `runs` (includes tasks, routines and drafts)

| Method and route | Description |
|---|---|
| `GET /runs/today` | Today's run (creates it if missing): generated map, HP, quests, node states |
| `GET /runs?from=&to=` · `GET /runs/:id` | History and detail |
| `POST /runs/:runId/nodes/:nodeId/enter` | Enter the node: Enemy/Elite/Boss → creates task; Event → draws card; Shop → offers; Rest → available |
| `POST /runs/:runId/close` | Manual day close (close bonus; applies failures of in-progress tasks) |
| `POST /tasks/:id/timer/start` · `/pause` · `/resume` · `/finish` | Timer cycle |
| `POST /tasks/:id/complete` | `{ evidenceIds[], note? }` → validates and pays rewards (ledger) |
| `POST /tasks/:id/fail` | `{ reason? }` → applies damage |
| `POST /tasks/:id/skip` | `{ itemId }` (Jump Feather) |
| `GET /runs/recap/weekly` | Weekly recap (generated; AI or template) |
| `GET /routines` · `POST /routines` · `PATCH/DELETE /routines/:id` | Repeatable routines |
| `GET /tasks/pool` · `POST /tasks/drafts` · `PATCH/DELETE /tasks/drafts/:id` | Pool of candidates: approved drafts, manual ones, today's routines |

### 2.5 `economy`

| Method and route | Description |
|---|---|
| `GET /wallet` | Current balances (same info as `users/me/wallet`; here for economy transparency) |
| `GET /ledger?cursor=` | Append-only ledger entries (auditable by the user) |
| `POST /runs/:runId/revive` | Consume Phoenix Drop (if any) and revive |

### 2.6 `inventory`

| Method and route | Description |
|---|---|
| `GET /inventory` | Owned items and vouchers |
| `POST /inventory/use` | `{ itemId, context? }` → applies effect (heal, shield, reroll…) |

### 2.7 `shop`

| Method and route | Description |
|---|---|
| `GET /shop/offers?runId=` | Offers for the current visit (3 + guaranteed voucher) |
| `POST /shop/purchase` | `{ offerId }` → deducts gold and delivers (transactional + idempotent) |
| `GET /shop/rewards` · `POST` · `PATCH/DELETE /:id` | Personal voucher catalog (name, rarity, duration, description) |

### 2.8 `quests`

| Method and route | Description |
|---|---|
| `GET /quests/today` | Quests of the day with progress |
| `GET /quests/history?cursor=` | History |

### 2.9 `events`

| Method and route | Description |
|---|---|
| `GET /events/deck` · `POST /events/cards` · `PATCH/DELETE /events/cards/:id` | Personal card deck (approve, edit, archive) |
| `POST /events/:eventId/resolve` | `{ choice: "accept" \| "decline" \| "reroll", itemId? }` |

### 2.10 `evidence`

| Method and route | Description |
|---|---|
| `POST /evidence/uploads` | `{ contentType, size }` → `{ evidenceId, uploadUrl, expiresAt }` (signed PUT; linked to the task on completion) |
| `POST /evidence/:id/confirm` | `{ checksum }` → associates the evidence with the task |
| `GET /evidence/:id/url` | Read signed URL (5 min) |
| `DELETE /evidence/:id` | Deletes evidence (only if the run is closed) |

### 2.11 `sync`

| Method and route | Description |
|---|---|
| `POST /sync/push` | Batch of outbox operations (see [`sync-offline.md`](../sync-offline.md)) |
| `GET /sync/pull?cursor=` | Changes since the cursor (versioned entities) |
| `WS /sync/stream` | Event `{ type: "changed", entities: [...] }` → the client pulls |

### 2.12 `ai`

| Method and route | Description |
|---|---|
| `POST /ai/goals/plan` | Goal → milestones + candidate tasks. **202 + `jobId`** (smart model) |
| `POST /ai/tasks/generate` | Fills the daily pool (fast model, synchronous) |
| `POST /ai/decks/suggest` | Proposes cards (events) or vouchers (shop) |
| `POST /ai/shop/offers` | Proposes the day's Shop offers (only from the approved catalog) |
| `POST /ai/setup/stats-skills` | Onboarding: proposes initial stats/skills |
| `POST /ai/recap/weekly` | Generates the recap (202 + `jobId`) |
| `GET /ai/jobs/:id` | Status and result of a job |
| `GET /ai/usage` | Tokens and monthly budget (cost transparency) |

### 2.13 `notifications`

| Method and route | Description |
|---|---|
| `POST /notifications/devices` · `DELETE /notifications/devices/:id` | Register/remove push token per device |
| `GET /notifications/preferences` · `PATCH` | What is notified and when (anti-guilt tone by default) |

---

## 3. Example flows

### 3.1 Full day: completing an Enemy

```
1. GET /runs/today
   → 200 { runId, dayKey, hp: {current: 110, max: 110}, gold: 45,
           map: { nodes: [...], edges: [...] }, quests: [...] }

2. POST /runs/{runId}/nodes/{nodeId}/enter
   → 200 { node: { type: "enemy" },
           task: { id, title, difficulty: 3, durationMin: 45,
                   evidenceTypes: ["photo","note"], skills: [...] } }

3. POST /tasks/{taskId}/timer/start        → 200 { timerId, startedAt }
   (pauses and resumption analogous)

4. POST /evidence/uploads
   → 201 { evidenceId, uploadUrl, expiresAt }
   PUT {uploadUrl}  (binary, directly to storage)
   POST /evidence/{evidenceId}/confirm { checksum }

5. POST /tasks/{taskId}/timer/finish       → 200 { elapsedSec }

6. POST /tasks/{taskId}/complete { evidenceIds: ["ev_..."], note? }
   → 200 { result: "completed",
           rewards: { gold: 16, xp: 30, itemDrops: [] },
           questsUpdated: [{ questId, progress: "2/2", completed: true }],
           wallet: { gold: 61, level: 3, xp: 140 }, hp: {...} }
```

### 3.2 Sync after playing offline

```
POST /sync/push
{
  "ops": [
    { "clientOpId": "0192...a1", "type": "task.complete",
      "payload": { "taskId": "t_01", "evidenceIds": ["ev_09"] } },
    { "clientOpId": "0192...a2", "type": "shop.purchase",
      "payload": { "offerId": "of_04" } },
    { "clientOpId": "0192...a1", "type": "task.complete",
      "payload": { "taskId": "t_01", "evidenceIds": ["ev_09"] } }   // intentionally duplicated
  ]
}
→ 200
{
  "results": [
    { "clientOpId": "0192...a1", "status": "applied",  "result": { "gold": 16, "xp": 30 } },
    { "clientOpId": "0192...a2", "status": "rejected", "error": "INSUFFICIENT_GOLD" },
    { "clientOpId": "0192...a1", "status": "duplicate", "result": { "gold": 16, "xp": 30 } }
  ],
  "cursor": "cur_88af..."
}
```

The client reverts the UI of the rejected operation and explains the reason; the duplicate one is a successful no-op.

### 3.3 AI planning (asynchronous)

```
POST /ai/goals/plan { goalId: "g_12", context: { hoursPerWeek: 6 } }
→ 202 { jobId: "job_31" }

GET /ai/jobs/job_31  → 200 { status: "running" }
GET /ai/jobs/job_31  → 200 { status: "succeeded",
    result: { milestones: [...], taskDrafts: [...] } }
```

The user reviews and approves in the UI; what is approved goes to `POST /tasks/drafts` (or `POST /goals/:id/milestones`).

---

## 4. Compatibility and evolution

- Clients must tolerate **new fields** in responses (additive by default).
- Removing a field or changing semantics requires `/v2` and a coexistence window.
- Enums (`nodeType`, `taskStatus`, `ledgerType`) are validated as open strings in clients so they do not break with additions.
- `PUT /users/me/seed-salt` is idempotent and additive: repeating it with the same salt returns `204` and the stored salt is never rotated (see `docs/adr/0015-local-first-seed-salt.md`).
