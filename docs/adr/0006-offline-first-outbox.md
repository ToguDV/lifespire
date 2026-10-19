# ADR-006: Offline-first with outbox and incremental pull (no CRDT)

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** [`ARCHITECTURE.md` §7](../../ARCHITECTURE.md#7-sync-and-offline), [`docs/sync-offline.md`](../sync-offline.md), ADR-003

## Context

The daily run must be fully playable without a connection: map generation, tasks, timers, evidence and day close all happen locally. When the device reconnects, local actions and server state must merge without duplicating gold or losing completed tasks.

## Decision

Clients keep an **operation outbox** (IndexedDB on web/desktop-web, SQLite in the Tauri and Expo apps) where every action is queued with a `clientOpId` and applied optimistically. On reconnect they **push** the batch to `POST /v1/sync/push` (per-op `applied`/`duplicated`/`rejected`) and **pull** changes since a cursor from `GET /v1/sync/pull`. Conflicts are resolved by per-entity rules (mostly last-write-wins, terminal task states win, evidence is append-only). No CRDT layer is used. The WebSocket `/v1/sync/stream` only signals that changes exist.

## Consequences

- + The core loop works on a plane, in a basement or with a flaky connection.
- + A simple, debuggable merge model instead of a CRDT runtime with its own metadata.
- + Idempotency (ADR-003) makes replaying the outbox safe by construction.
- − Per-entity merge rules must be defined and tested one by one; a missed case is a data-loss risk.
- − Multi-device simultaneous edits converge to a "last writer" outcome that the UI must not pretend is richer than it is.
