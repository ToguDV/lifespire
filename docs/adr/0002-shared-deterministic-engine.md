# ADR-002: Shared deterministic game engine in pure TypeScript

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** [`ARCHITECTURE.md` §1, §4](../../ARCHITECTURE.md), [`docs/sync-offline.md`](../sync-offline.md#3-daily-seed-and-offline-generation), [`GDD.md` §5](../../GDD.md)

## Context

A day's map must be identical bit for bit on web, desktop, Android and the server; players can play it fully offline; and the server has to re-generate the same map to validate the events on it. Any platform-specific dependency or hidden state would break that equality.

## Decision

Every game rule lives once in `packages/engine`, in **pure TypeScript with no DOM, no Node APIs and no I/O**. It exposes deterministic RNG (`xoshiro128**`), map generation, `layoutMap()`, the damage/gold/XP/drop formulas and validators. The daily seed is `HKDF(userSeedSalt, dayKey + engineVersion)`; balance numbers are data loaded from `balance/*.json`, and `ENGINE_VERSION` is bumped on every change that alters generation or rules.

## Consequences

- + Identical results on all platforms and full offline generation of the daily map.
- + The server can re-generate a run's map and reject inconsistent events.
- + Golden snapshots per `engineVersion` catch unintended generation drift.
- − Every generation change requires an `ENGINE_VERSION` bump plus new golden snapshots.
- − The engine must stay dependency-free, which sometimes means hand-rolling small utilities.
