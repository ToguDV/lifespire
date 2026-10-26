# ADR-0006 — Foreground change feed via authenticated long-poll

> Date: 2026-10-25. Status: accepted. Complements ADR-0001 (snapshot sync) and
> ADR-0004 (client-side auto-merge) without changing their wire semantics.

## Context

Until now every client pulled the cloud snapshot on a 60-second poll plus focus,
visibility and network events. A change made on desktop could take up to a
minute to appear on Android or web, which is not "the same save everywhere" in
practice. The product now expects near-real-time propagation between the user's
devices while the app is open.

Constraints that shaped the decision:

- The Electron renderer never calls the API directly: request/response goes
  through the main-process proxy (`lifespire:api-request`). A streaming design
  would need a new IPC channel, sender validation, cancellation and a streaming
  client on React Native.
- The server is a dumb versioned store. It must not merge or send the document
  over the notification channel; game rules stay in the clients and the API
  validates full documents on push.
- Auth is a 15-minute bearer token with single-flight refresh; the channel must
  reuse it and not introduce a second credential path.
- One API container today. A future second replica must not break correctness,
  only latency.

## Decision

Add a version-only change feed: `GET /v1/sync/watch?since=<version>`.

1. If the cloud version is newer than `since`, respond immediately with
   `{ version, updatedAt }`. Otherwise hold the request for up to
   `SYNC_WATCH_TIMEOUT_MS` (25 s, max 30 s) and wake it when a `PUT` or `DELETE`
   for the same user commits.
2. The notification never contains the document, only the new version (or
   `version: null` for a delete). The client pulls through the existing
   `GET /v1/sync` with its `ETag`.
3. On timeout the handler re-reads the version before answering. A missed
   in-process notification (API restart, a second instance) therefore still
   reaches the client within one wait instead of being lost.
4. `SyncService` notifies only on real version bumps (`created`/`updated`) and
   on delete. No-op, replay and conflict paths do not notify.
5. The route is authenticated, `Cache-Control: no-store`, excluded from the
   global throttle (a long-poll cannot share the 120/min IP bucket) and bounded
   per user: 16 concurrent watchers and 60 opens/minute per user
   (`429 SYNC_WATCH_LIMIT`). Watch requests are excluded from the pino access
   log. `wait` is clamped to `SYNC_WATCH_TIMEOUT_MS`.
6. The shared engine (`packages/app-core`) owns a single loop: it registers a
   cursor independent from `serverVersion`, pulls when the version differs,
   defers a pull while pushing or in conflict, advances the cursor even when it
   cannot pull, backs off on errors and stops on background/offline/sign-out.
   A direct remote apply fires an `onRemoteApplied` hook (the clients show a
   discreet "Updated from another device." toast). A 40 s watchdog aborts a
   zombie request and rejoins the loop.
7. Clients that meet a server without the endpoint (404/405/501) fall back to
   the old 60 s poll for the rest of the session. Old clients are unaffected,
   so the API can ship first.
8. A `version: null` event (cloud copy deleted elsewhere) keeps the local save:
   the engine drops the stale cursor/meta and recreates the cloud copy on the
   next local edit. Nothing is deleted silently.

## Rationale

- Perceived latency is one round trip after the 1.5 s push debounce, without a
  persistent socket, a proxy buffering change, a new IPC surface or a React
  Native streaming dependency.
- The cursor is a version, not an event id: reconnect, restart or a missed
  notification is self-healing at the next wait, and there is no replay buffer
  to size or persist.
- The document stays out of the feed: no duplicate 512 KB payloads, no extra
  validation surface, and the server remains a store rather than a game engine.

## Consequences

- The in-process notifier is instantaneous on one API process. With several
  replicas, watchers connected to another replica learn about the change on
  their next timeout (≤25 s), still better than the old minute. Proper fanout
  needs Postgres `LISTEN/NOTIFY` or Redis and is a follow-up.
- Real time applies while the app is open: the web/desktop pause the feed when
  hidden and Android when backgrounded; login, focus or reconnect pulls first.
  A closed mobile app still needs FCM/APNs (out of scope, as before).
- The push debounce remains 1.5 s, so "instant" means immediately after the
  device decides to push, not on every keystroke.
- Every watch connect costs an active-account check plus a version read; the
  25 s timeout re-read adds one more query per client, acceptable for the
  closed beta and cheaper than a 60 s snapshot poll.

## Alternatives considered

- **SSE**: the natural push primitive, but Electron would need a new streaming
  IPC bridge (token handling, cancellation, sender validation) and Android a
  streaming HTTP client. Deferred until the client count or event richness
  justifies it.
- **WebSocket**: bidirectional and heavier; client-to-server changes already
  use the versioned `PUT`, so the extra direction buys nothing.
- **Short polling (5 s)**: no server change, but 12 requests/minute per client,
  worse on battery and on the shared-IP throttle, and still not instant.
- **Server-side merge/push**: rejected in ADR-0004; it moves game rules into the
  API and recreates deploy-order problems.
- **Remote push notifications**: different problem (closed app), requires
  FCM/APNs/Expo Push and token registration. Stays out of scope.
