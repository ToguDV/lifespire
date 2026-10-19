# ADR-003: Server-authoritative economy via idempotent event ledger

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** [`ARCHITECTURE.md` §6.2, §8](../../ARCHITECTURE.md), [`docs/sync-offline.md`](../sync-offline.md#4-outbox-and-operations), [`docs/data-model.md`](../data-model.md)

## Context

The client is offline-first and works on several devices, so it cannot be trusted with balances: retries, duplicate devices or a tampered client could duplicate gold and XP. At the same time the UI must feel instant, which rules out waiting for the server on every action.

## Decision

The server **never accepts balances, only events**. The client proposes an operation with a `clientOpId` (UUIDv7) and the server processes it in a transaction: it validates state against engine rules, inserts the append-only `LedgerEntry` (`ON CONFLICT (clientOpId) DO NOTHING`) and updates materialized balances. A retry with the same `clientOpId` returns the original result instead of re-applying it. Rejected operations make the client revert its optimistic UI.

## Consequences

- + Gold, HP, XP and items cannot be duplicated by retries, multiple devices or a modified client.
- + The ledger is auditable and exportable, which supports the transparency pillar.
- + Optimistic UI stays responsive; only rejections need a rollback path.
- − Every gameplay action needs a defined, versioned operation contract and an idempotency key.
- − Rejections must be explained by the UI, adding error-handling work per action.
