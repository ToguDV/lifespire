# ADR-016: Map generation parameterized by rule profiles

- **Status:** Accepted
- **Date:** 2026-10-18
- **Related:** [`GDD.md` §5, §6](../../GDD.md), [`ARCHITECTURE.md` §4.3](../../ARCHITECTURE.md), ADR-002

## Context

The M0 map is deliberately thinner than the target design: no events, shops, rests or boss, because those depend on systems that do not exist yet. Hardcoding that reduced shape into the generator would mean rewriting generation logic later, and any number placed in code would drift from the balance tables.

## Decision

Map generation is parameterized by a **rule profile** declared in `packages/engine/balance/*.json`, composed of a `nodeTypeSet` plus a set of `guarantees`. The **M0 profile** allows only `enemy` and `elite`, generates **8 rows** (7 plus a final row) with **2–4 nodes per row**, forces **row 1 to be an Enemy**, and lays out **2–3 routes that reconverge**. The Rest/Shop guarantees and the closing-day Boss stay **disabled** in that profile. All numbers live only in the balance JSON, never in code (see [GDD Appendix A](../../GDD.md#19-appendix-a--initial-balance)).

## Consequences

- + Later content (events, shops, rests, boss) is enabled by editing a profile, not by rewriting the generator.
- + M0 ships a valid, connected, winnable map with much less content risk.
- + Golden tests can pin each profile independently per `engineVersion`.
- − Every profile needs its own invariant tests, since guarantees and connectivity differ per shape.
- − A profile whose guarantees cannot be satisfied is a generation failure the validator must report, not silently degrade.
