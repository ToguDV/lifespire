# ADR-017: `dayKey` as a pure engine function

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** [`ARCHITECTURE.md` §4](../../ARCHITECTURE.md), [`docs/sync-offline.md` §3](../sync-offline.md#3-daily-seed-and-offline-generation), ADR-002

## Context

`dayKey` feeds the daily seed, so the server and every client must compute the same string for the same moment. `Intl` and `Date` timezone handling vary across runtimes and platform ICU data, which would let two devices disagree about which day a run belongs to — breaking both determinism and server validation.

## Decision

`dayKey(timestampMs, tzOffsetMinutes, closeHour)` is a **pure engine function built only from integer arithmetic, with no `Intl` dependency**, so `packages/engine` stays platform-independent. The client reads its timezone offset with `Intl` when the app opens and persists it in settings, passing it as an argument. Defaults per [`docs/sync-offline.md`](../sync-offline.md#3-daily-seed-and-offline-generation): the **system timezone** and **`closeHour = 4`**.

## Consequences

- + The same instant yields the same `dayKey` on web, desktop, Android and the server.
- + The engine keeps its zero-dependency rule, which golden tests rely on.
- + `closeHour` and the offset are explicit inputs, so they are testable in isolation.
- − A device that changes timezone or crosses DST must refresh and persist its offset, or its day boundary drifts.
- − The engine cannot itself resolve a timezone name; that responsibility stays on the client.
