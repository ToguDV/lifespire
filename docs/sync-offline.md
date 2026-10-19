# Sync and offline — protocol

> **Status:** specification (v1.0, frozen 2026-10-18). Implements the principles of [`ARCHITECTURE.md`](../ARCHITECTURE.md) §7 and the server-authoritative economy of §6.2.
> **Goal:** play the full daily run offline on web, desktop and Android, and reconcile without duplicating gold, XP or items.

---

## 1. Principles

1. **The client simulates, the server decides.** The UI applies effects immediately (optimistic), but the truth of the economy is the server's ledger.
2. **Total idempotency.** Every operation carries `clientOpId` (UUIDv7). Retrying never duplicates.
3. **Persistent outbox.** Operations are stored in local storage until the server confirms them.
4. **Incremental pull.** The client caches and updates by cursor; the WebSocket only notifies "there are changes".
5. **The map is deterministic.** With a cached `userSeedSalt`, the client generates the same map as the server, even offline.

---

## 2. Local storage per platform

| Platform | Technology | Content |
|---|---|---|
| Web | IndexedDB (Dexie) | Outbox, run/map/task cache, wallet, pending evidence blobs, `meta` (cursor, `userSeedSalt`, `engineVersion`) |
| Desktop (Tauri) | SQLite (`tauri-plugin-sql`) | Same logical schema |
| Android (Expo) | SQLite (`expo-sqlite`) | Same logical schema |

Minimal local schema:

```
meta(key, value)               // cursor, userSeedSalt, engineVersion, userId
runs(id, dayKey, data)         // snapshot of the run and its map
tasks(id, data)                // instances
wallet(data)                   // gold, level, xp, streak
outbox(seq, clientOpId, type, payload, createdAt, attempts, lastError)
evidenceBlobs(localId, taskLocalId, filePath/blob, mimeType, size, checksum, uploadedEvidenceId)
```

---

## 3. Daily seed and offline generation

```
dailySeed = HKDF(userSeedSalt, dayKey + engineVersion)
```

- **M0 (no backend):** `userSeedSalt` (32 bytes hex) is generated locally on the first launch with `crypto.getRandomValues` and stored in the local `meta` store.
- **M2 (migration):** `GET /users/me` → `seedSalt` returns the account's salt. If the account does not have one yet (migrating local M0 data), the client proposes its local salt through the idempotent endpoint `PUT /users/me/seed-salt` (see [`api/README.md`](./api/README.md)).
- Once set, the salt is **never rotated**, so maps already created remain reproducible; the server never issues a different salt for pre-existing local data.
- The salt **does not travel through the outbox**: it is content/session state, not a game operation.
- **Online:** `GET /runs/today` creates/returns the run on the server (canonical source of the map).
- **Offline:** if the day's run is not cached, the client generates it locally with the engine and leaves it as **provisional**; it queues `run.open` with `{ dayKey, engineVersion }`.
- On sync, the server **re-generates** the map with the same seed and version:
  - Same graph ⇒ it is adopted and pending operations are processed normally.
  - Difference (different engine version, corrupt data) ⇒ the server returns the canonical map. If the client has already resolved nodes, it reconciles by `nodeId`; operations on non-existent nodes are rejected and notified (extremely rare case; covered by tests).

---

## 4. Outbox and operations

### 4.1 Operation model

```json
{
  "clientOpId": "0192f3a2-...",
  "type": "task.complete",
  "payload": { "taskId": "t_01", "evidenceIds": ["ev_9"], "note": null },
  "clientTs": "2026-10-18T15:04:03.120Z",
  "attempts": 0
}
```

| Field | Rule |
|---|---|
| `clientOpId` | UUIDv7 generated when queuing; unique per user in the ledger |
| `clientTs` | Only for timer/close validations; it **never** decides balances |
| Order | The client sends in queuing order; the server processes the batch in reception order |
| TTL | 7 days; after that it is rejected as expired (`INVALID_STATE`) and the user is informed |
| Retries | Exponential backoff (max. 60 s); 4xx errors = definitive (marked as rejected); 5xx/network = retry |

### 4.2 Operation catalog

| `type` | Payload | Server validation |
|---|---|---|
| `run.open` | `{ dayKey, engineVersion }` | Regenerates and compares the map; creates the run if it does not exist |
| `node.enter` | `{ runId, nodeId }` | Node `available`/neighbor of the current one; creates the task/draws a card/offers |
| `task.timer.start` / `pause` / `resume` / `finish` | `{ taskId, at? }` | Timer state order; `at` is clamped to the run window |
| `task.complete` | `{ taskId, evidenceIds[], note? }` | Task `in_progress`, valid evidence from the owner, timer started |
| `task.fail` | `{ taskId, reason? }` | Unresolved task; applies damage |
| `task.skip` | `{ taskId, itemId }` | Jump Feather in inventory |
| `event.resolve` | `{ eventId, choice, itemId? }` | Card from the deck; `reroll` requires a Loaded Die |
| `rest.heal` | `{ nodeId }` | Rest node available, not used today |
| `shop.purchase` | `{ offerId }` | Offer from the visit, not purchased, enough gold |
| `item.use` | `{ itemId, context? }` | Item owned and applicable to the context |
| `run.revive` | `{}` | Phoenix Drop available; `dead` run in progress |
| `run.close` | `{ clientTs }` | Closes the run; applies failures of in-progress tasks and bonus if applicable |

> **Content (goals, decks, stats, skills, routines, settings) does not go through the outbox in M2:** editing it requires a connection (the UI indicates it). Gameplay itself is 100 % offline. If offline editing is wanted later, an LWW mutation channel (`content.upsert`, `content.delete`) will be added.

> **Day close (`run.close`):** in M0 there is no backend, so the close is resolved locally. Tasks still `in_progress` at close become `failed` only from M1 onward; in M0 they become `skipped` (no reward and no consequence — see [`roadmap.md`](./roadmap.md) §M0).

---

## 5. Protocols

### 5.1 Push

```
POST /v1/sync/push
{
  "ops": [ ...max. 200... ],
  "cursor": "cur_..."            // optional: cursor known by the client
}
```

Response:

```json
{
  "results": [
    { "clientOpId": "…", "status": "applied", "result": { "gold": 16, "xp": 30 } },
    { "clientOpId": "…", "status": "duplicate", "result": { "gold": 16, "xp": 30 } },
    { "clientOpId": "…", "status": "rejected", "error": { "code": "INSUFFICIENT_GOLD" } }
  ],
  "cursor": "cur_..."
}
```

- `applied`: executed now.
- `duplicate`: already existed (replay) → same result, no new effects.
- `rejected`: invalid → the client reverts the optimistic UI and explains.

### 5.2 Pull

```
GET /v1/sync/pull?cursor=cur_...&limit=500
```

```json
{
  "changes": [
    { "entity": "run", "id": "run_1", "rev": 7, "deleted": false, "data": { ... } },
    { "entity": "task", "id": "t_2", "rev": 3, "deleted": false, "data": { ... } },
    { "entity": "eventCard", "id": "ec_9", "rev": 2, "deleted": true }
  ],
  "nextCursor": "cur_...",
  "hasMore": false
}
```

- Invalid/expired cursor → `400 SYNC_CURSOR_INVALID` → full re-sync:
  `GET /v1/sync/pull?full=true` returns a snapshot (active run + wallet + content) and a new cursor.
- Pull does not touch the outbox: pending local operations remain queued.

### 5.3 WebSocket

`/v1/sync/stream` (socket.io, authenticated). Event `{ type: "changed", entities: ["run","task"] }` → the client pulls. It never transports critical state; if the socket drops, the client pulls on reconnect.

---

## 6. Merge and conflicts

| Entity | Owner | Strategy |
|---|---|---|
| `Run`, `MapNode`, `ShopOffer`, `DailyQuest` | Server | The client adopts what comes down via pull; it does not mutate structure |
| `TaskInstance` | Server (by ops) | **First terminal state wins** (reception order). Later ops → `ALREADY_RESOLVED`; the client reverts its optimistic UI and notifies |
| `TimerSession` | Server (by ops) | Append; no real conflicts |
| `Evidence` | Server (append-only) | Upload confirmation; no edits |
| `LedgerEntry`, `InventoryItem`, `StreakState` | Server | Read-only on the client (derived from ops) |
| `Goal`, `Milestone`, `StatDef`, `Skill`, `EventCard`, `RewardDef`, `Routine`, `TaskDraft`, `UserSettings` | Client (online) | LWW by `updatedAt` + server `rev`; deletion = tombstone (`archived`) |
| `User` (profile), balances | Server | Balances derived from the ledger |

**Two devices complete the same task offline:** the first op to reach the server wins; the second receives `ALREADY_RESOLVED`, reverts the optimistic reward and shows "this task was already resolved on another device". No duplicates.

**Offline death:** the client simulates HP and shows the provisional death screen; on sync, the server recalculates with the real operations. If the result differs (e.g., stats changed on another device), **the server wins** and the UI reconciles.

**Offline day close:** `run.close` can arrive up to 7 days later; the server records the close and applies the pending failures. Past the TTL, the close is forced by the passing of the day (without double penalty: failures were already counted when their ops were applied).

---

## 7. Offline evidence

1. The task is completed locally with `localEvidenceId`.
2. The blob (compressed photo) waits in `evidenceBlobs`.
3. On reconnect, the client **first uploads the blobs** (`POST /evidence/uploads` → signed PUT → `confirm`) and obtains the real `evidenceId`s.
4. Then it rewrites the references in the outbox and does `push` (that is why completions that reference blobs are sent after uploading).
5. If the user deletes the account or purges the run before uploading, the local blob is discarded.

Limits and policy (see `docs/adr/0014-client-side-evidence-policy.md`): client-side compression to ~1600 px WebP at quality 0.8; max. 10 MB per file; 50 evidence/day (configurable); SHA-256 checksum per blob; a warning is shown at 80 % of the storage quota; `navigator.storage.persist()` is requested on first use. Only photo, note and link (no video).

---

## 8. Recovery and error UX

| Case | Behavior |
|---|---|
| Network down | The UI operates normally; indicator "offline · N pending operations" |
| Rejected op | The optimistic effect is reverted + toast with the reason; the op remains in local history |
| Expired op (> 7 days) | It is discarded and the user is warned; local state is fully re-synced |
| Invalid cursor | Automatic full re-sync (`full=true`) |
| Conflict between devices | The server wins; a one-off notice in the UI ("resolved on another device") |
| Partial sync | The outbox is transactional per op: nothing is deleted until `applied`/`duplicate` is received |

---

## 9. Limits and security

- Max. 200 ops per push; total payload ≤ 256 KB.
- Sync rate limit: 60 push/min per user (backoff avoids bursts).
- Per-op authorization: every operation validates ownership and state on the server; a node from another run/user does not exist for you.
- The ledger is never edited; accounting corrections only via compensating ledger entries (not applicable in the MVP).
- Blobs are validated (MIME, size, checksum) before being associated.

---

## 10. Protocol tests (mandatory in M2)

1. **Idempotency:** applying the same batch twice produces the same state and balance.
2. **Two devices:** completing the same task on both → one reward, one `ALREADY_RESOLVED`.
3. **Full offline:** play a whole day in airplane mode, sync, verify ledger and balances.
4. **Deterministic map:** same seed + version ⇒ identical map client/server (golden test shared with `engine`).
5. **Rejections:** purchase without gold, skip without item, inverted timer → rejection without effects.
6. **Re-sync:** expired cursor ⇒ full snapshot without losing the outbox.
