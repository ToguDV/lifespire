# ADR-0004 — Conservative client-side auto-merge

> Amended by ADR-0007: the base is per paired peer; the merge itself is unchanged.

> Date: 2026-10-24. Status: accepted. Amends ADR-0001 (snapshot sync with
> explicit conflicts) without changing the wire protocol.

## Context

ADR-0001 rejected auto-merge: one writer per run-day in practice, and a naive
merge could produce impossible states (XP from branch A with the path of
branch B). In real two-device use, most conflicts are disjoint — one device
resolves a node while the other renames a goal — and forcing an explicit
keep-mine/keep-cloud choice every time loses work on one side by design.

## Decision

The web client attempts a conservative 3-way merge before opening the conflict
dialog. The merge base is the last-synced cloud copy, persisted per account
(`lifespire:mvp0:u:<id>:base`) on every successful push/pull alongside the
meta. `tryAutoMerge(base, local, remote)` in `@lifespire/core` is pure
(no `Date.now`/`Math.random`) and only succeeds when both sides' edits are
disjoint or byte-identical:

- One side untouched (or both identical): take the other side.
- `settings` / `onboardingDraft`: one side changed wins; both changed
  differently is a conflict.
- `goals` / `tasks`: merged per entity id (additions union, single-side edits
  win); the same id edited or added differently on both sides is a conflict.
- `profile`: names merge 3-way; `xp`/`gold` sum both forward deltas only when
  both sides resolved disjoint node sets (same node completed twice dedupes
  only when events and deltas are identical); `loot` unions by instance id and
  conflicts on duplicate catalogs. Backwards counters are a conflict.
- `run`: same run id required (a new run on one side is a conflict). Days
  merge paths/rewards by node id; two resolved nodes in the same map layer, the
  same node resolved differently, or divergent maps are conflicts. Totals are
  taken from the side matching the merged days, or recomputed for active runs.
  Objectives sum forward progress deltas.

On success the engine applies the merged document, backs up the pre-merge
local copy (`documentStorage.backup()`), and pushes with `If-Match` set to the
remote version it merged against — the server CAS still serializes writers, so
a racing third device just triggers one more merge round. On any ambiguity the
engine opens the existing keep-mine/keep-cloud dialog, now listing the merge
conflict reasons. Without a stored base (legacy installs until their next
successful sync) conflicts stay manual.

## Rationale

- The server stays a dumb versioned store: no protocol change, no deploy
  ordering issues, no new validation surface (the merged document still passes
  `parseDocument`, and the server re-validates game rules).
- Additive profile counters never lose progress, and every rejection falls
  back to explicit user choice with both copies intact — zero silent loss.
- Merge lives in `packages/core` next to the rules it must respect, covered by
  unit tests; the engine only orchestrates base storage and the push.

## Consequences

- First sync after upgrading has no base: one last manual dialog is possible,
  then auto-merge takes over.
- Run close vs concurrent edits, same-layer path divergence, and loot
  duplicate-catalog collisions always ask the user.
- `GET /v1/admin/sync-metrics` is unchanged: auto-merged pushes count as
  `updated`, remaining fallbacks as `conflict`.
- If disjoint conflicts still hurt in real use, the next step remains the
  operation journal from ADR-0001 — not a broader merge.

## Alternatives considered

- Server-side merge endpoint: rejected — moves game-rule reasoning into the
  API, needs versioned merge semantics and deploy coordination for no benefit
  over a client merge against CAS.
- Last-write-wins / field-level LWW: rejected — silently drops the loser's
  resolutions (see ARCHITECTURE-REVIEW ARQ-01).
