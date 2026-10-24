# ADR-0001 — Snapshot sync with explicit conflicts

> Date: 2026-10-24. Status: accepted. Context: multi-device sync for one
> `GameDocument` per user.

## Decision

Synchronize whole-document snapshots with a monotonic server `version`
(`ETag` / `If-Match` / `If-None-Match: *`) and a required `Idempotency-Key`.
Conflicts (`412`) never auto-merge: the client downloads the remote version
and asks the user (keep mine / keep cloud, with backups of both).

## Rationale

- One writer per run-day in practice; true concurrent edits are rare, so the
  cost of a journal/CRDT outweighs its benefit today.
- Snapshot + compare-and-swap gives exactly-once semantics with simple
  reasoning: one winner, one explicit conflict, no impossible merged states
  (e.g. XP from branch A with the path of branch B).
- Idempotency keys make retries and multi-tab pushes safe.

## Consequences

- Large documents cost a full upload per change (512 KB cap, gzip, debounce
  client-side). If this hurts, the next step is an operation journal, not a
  bigger snapshot.
- Clients must implement the conflict dialog and per-account local keys.

## Alternatives considered

- Operation journal + rebase: better offline multi-device, but requires
  recording every transition and rewriting the store. Deferred until
  conflicts prove painful in real use.
- Last-write-wins: rejected — silent progress loss (see ARCHITECTURE-REVIEW
  ARQ-01).
